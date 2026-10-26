#!/usr/bin/env python3
"""Prepare an index snapshot, or verify/apply its fixed-repository CI transport."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

REPOSITORY = "https://github.com/ValentinMouret/fitness.git"
REPOSITORY_NAME = "ValentinMouret/fitness"


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])


def hexadecimal(value: str, length: int) -> str:
    if re.fullmatch(rf"[0-9a-f]{{{length}}}", value) is None:
        raise ValueError(f"Expected {length} lowercase hexadecimal characters")
    return value


def safe_path(path: str) -> None:
    parts = path.split("/")
    if any(part in ("", ".", "..") for part in parts) or "\\" in path:
        raise ValueError("Unsafe source path")
    if any(ord(char) < 32 or ord(char) == 127 for char in path):
        raise ValueError("Control characters in source path")
    for part in parts:
        lower = part.lower()
        if lower == ".env.example":
            continue
        if lower in (".git", ".ssh", ".secrets", ".netrc", ".npmrc", "id_rsa", "id_ed25519") or lower == ".env" or lower.startswith(".env."):
            raise ValueError("Credential or Git metadata path in snapshot")


def inventory(tree: str) -> list[dict[str, str]]:
    hexadecimal(tree, 40)
    if git("cat-file", "-t", tree).strip() != b"tree":
        raise ValueError("Snapshot object must be a tree")
    entries = []
    links = {}
    for raw in git("ls-tree", "-r", "-t", "-z", tree).split(b"\0"):
        if not raw:
            continue
        metadata, raw_path = raw.split(b"\t", 1)
        mode, kind, oid = metadata.decode("ascii").split(" ")
        path = raw_path.decode("utf-8")
        safe_path(path)
        if mode not in ("040000", "100644", "100755", "120000"):
            raise ValueError("Unsupported tree mode or submodule")
        if mode == "120000":
            target = git("cat-file", "blob", oid).decode("utf-8")
            if not target or target.startswith("/") or "\\" in target or "\0" in target:
                raise ValueError("Unsafe symlink target")
            links[path] = target
        if kind != "tree":
            entries.append({"path": path, "mode": mode, "object": oid})
    # Resolve the whole graph: a safe-looking target can traverse another link.
    for path in links:
        remaining = path.split("/")
        resolved: list[str] = []
        traversed = 0
        while remaining:
            part = remaining.pop(0)
            if part in ("", "."):
                continue
            if part == "..":
                if not resolved:
                    raise ValueError("Symlink escapes the source root")
                resolved.pop()
                continue
            candidate = "/".join([*resolved, part])
            if candidate in links:
                traversed += 1
                if traversed > 40:
                    raise ValueError("Symlink cycle or excessive indirection")
                remaining = links[candidate].split("/") + remaining
            else:
                resolved.append(part)
        if resolved:
            safe_path("/".join(resolved))
    return entries


def archive_digest(tree: str) -> str:
    with tempfile.TemporaryFile() as stream:
        subprocess.run(["git", "-c", "tar.umask=0002", "archive", "--format=tar", "--mtime=2000-01-01T00:00:00Z", tree], stdout=stream, check=True)
        stream.seek(0)
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
        return digest.hexdigest()


def verify_identity(tree: str, digest: str, head: str) -> None:
    hexadecimal(tree, 40)
    hexadecimal(digest, 64)
    hexadecimal(head, 40)
    if git("rev-parse", "HEAD").decode().strip() != head:
        raise ValueError("Source HEAD changed")
    if git("write-tree").decode().strip() != tree:
        raise ValueError("Source index changed")
    subprocess.run(["git", "diff", "--quiet", "--"], check=True)
    inventory(tree)
    if archive_digest(tree) != digest:
        raise ValueError("Canonical source archive checksum mismatch")
    print(f"Verified source_head={head} tree={tree} archive_sha256={digest}")


def apply_existing(tree: str, digest: str, head: str) -> None:
    hexadecimal(tree, 40)
    hexadecimal(digest, 64)
    hexadecimal(head, 40)
    inventory(tree)
    if git("cat-file", "-t", head).strip() != b"commit":
        raise ValueError("Source HEAD must be a commit")
    if archive_digest(tree) != digest:
        raise ValueError("Canonical source archive checksum mismatch")
    subprocess.run(["git", "diff", "--quiet", "--"], check=True)
    subprocess.run(["git", "diff", "--cached", "--quiet", "--"], check=True)
    # Git applies validated objects; the canonical tar is never extracted.
    subprocess.run(["git", "read-tree", "--reset", "-u", tree], check=True)
    subprocess.run(["git", "update-ref", "--no-deref", "HEAD", head], check=True)
    verify_identity(tree, digest, head)


def prepare(output: str | None) -> None:
    tree = git("write-tree").decode().strip()
    head = git("rev-parse", "HEAD").decode().strip()
    entries = inventory(tree)
    digest = archive_digest(tree)
    folder = Path(output) if output else Path(tempfile.mkdtemp(prefix="fitness-hosted-snapshot-"))
    folder.mkdir(parents=True, exist_ok=True)
    manifest = {"tree": tree, "archive_sha256": digest, "source_head": head, "files": entries}
    (folder / "snapshot.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({key: value for key, value in manifest.items() if key != "files"}, indent=2))
    print(f"Inventory: {folder.resolve() / 'snapshot.json'} ({len(entries)} files)")
    print("Prepared locally only. Publishing exposes the complete staged source publicly.")
    print("After explicit owner approval, publish this exact tree and dispatch trusted main:")
    print(f"git push {REPOSITORY} {tree}:refs/tags/codex-snapshots/{tree}")
    print(f"gh workflow run ci.yml --repo {REPOSITORY_NAME} --ref main -f tree={tree} -f archive_sha256={digest} -f source_head={head}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command")
    prep = sub.add_parser("prepare")
    prep.add_argument("--output")
    for command in ("apply", "verify"):
        action = sub.add_parser(command)
        action.add_argument("--tree", required=True)
        action.add_argument("--archive-sha256", required=True)
        action.add_argument("--source-head", required=True)
    args = parser.parse_args()
    os.chdir(git("rev-parse", "--show-toplevel").decode().strip())
    if args.command in (None, "prepare"):
        prepare(getattr(args, "output", None))
        return
    tree = hexadecimal(args.tree, 40)
    digest = hexadecimal(args.archive_sha256, 64)
    head = hexadecimal(args.source_head, 40)
    if args.command == "verify":
        verify_identity(tree, digest, head)
        return
    if os.environ.get("GITHUB_EVENT_NAME") != "workflow_dispatch" or os.environ.get("GITHUB_REF") != "refs/heads/main" or os.environ.get("GITHUB_REPOSITORY") != REPOSITORY_NAME:
        raise ValueError("Snapshot apply is restricted to the fixed repository's trusted main dispatch")
    destination = f"refs/fitness-snapshots/{tree}"
    subprocess.run(["git", "fetch", "--no-tags", REPOSITORY, f"refs/tags/codex-snapshots/{tree}:{destination}"], check=True)
    if git("rev-parse", destination).decode().strip() != tree or git("cat-file", "-t", destination).strip() != b"tree":
        raise ValueError("Published tag does not directly name the expected tree")
    if subprocess.run(["git", "cat-file", "-e", head], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        subprocess.run(["git", "fetch", "--no-tags", "--depth=1", REPOSITORY, head], check=True)
    apply_existing(tree, digest, head)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, UnicodeError, subprocess.CalledProcessError) as error:
        print(f"Snapshot rejected: {error}", file=sys.stderr)
        sys.exit(1)
