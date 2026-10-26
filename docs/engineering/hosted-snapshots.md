# Hosted verification before application commits

This is a proposed bootstrap package. It has not published source, dispatched a
workflow, or changed an application commit. Owner approval is required before
publishing a snapshot or enabling the bootstrap on main.

## One bootstrap exception

The native hosted gate cannot run a staged tree until its trusted workflow knows
how to receive one. The proposed exception is one independently reviewed workflow
and tooling commit on main, containing no application code, before that native
gate is available. It pins Ubuntu 24.04, Node 22.23.3 and Bun 1.3.14, installs both
Chromium and WebKit, and adds snapshot transport to the existing full gate.
Afterwards application commits must wait for the exact staged tree to pass that
native Linux gate. The bootstrap exception is not approval to publish or dispatch.
The package also repairs the broken absolute `CLAUDE.md` symlink to the existing
relative `AGENTS.md`, so the snapshot is portable.

## Enforcing the commit rule

This bootstrap enables native validation; it does not install a commit hook.
Before each application commit, Dev must verify that the dispatched run completed
successfully, its before/after identity checks match the submitted tree and digest,
and a fresh local `prepare` still produces that same tree and digest. Record the
run URL and identities with the review. Any staged change invalidates that proof
and requires another full run. Commit only the passed tree, then verify the
commit's tree matches it. Normal PR CI remains required as well.

Automatic hook enforcement belongs to the remaining ENSO-124 work. Until then,
the delivery rule is enforced by these checks before the commit; neither this
helper nor its printed commands alone prevents an unchecked `git commit`.

## Prepare locally

Stage the intended application changes, then run:

```sh
python3 scripts/hosted-snapshot.py prepare
```

The default invocation with no subcommand is also prepare-only. The helper writes
a local JSON source inventory and prints the 40-character tree, original source
HEAD and canonical archive SHA256. It creates no commit, remote ref or workflow
run. Unstaged and untracked files are excluded. Review the inventory and source
before requesting publication approval. Known credential paths, Git metadata,
submodules, path traversal and escaping/cyclic symlinks are rejected. These name
checks do not prove that ordinary source files contain no embedded secrets.

Canonical checksum calculation is:

```sh
git -c tar.umask=0002 archive --format=tar --mtime=2000-01-01T00:00:00Z TREE | shasum -a 256
```

The archive is hashed, never extracted. Git object IDs, tree type, canonical
checksum and the full path/symlink graph are verified before Git applies objects
with `read-tree`. The source index and tracked working files are verified after
application, immediately before the shared gate and after it, including failure.
The source HEAD is retained without creating an application commit. Evidence must
identify both that original HEAD and the exact tree; HEAD alone is insufficient.

## Publication and dispatch after approval

The helper prints the exact proposed commands. They use this fixed public
repository, a tree-only tag named `refs/tags/codex-snapshots/TREE`, and the trusted
workflow on `main`. There are no caller-supplied download URLs, commands, provider
credentials, production cookies or deployment secrets in the transport.

```sh
git push https://github.com/ValentinMouret/fitness.git TREE:refs/tags/codex-snapshots/TREE
gh workflow run ci.yml --repo ValentinMouret/fitness --ref main \
  -f tree=TREE -f archive_sha256=CANONICAL_SHA256 -f source_head=SOURCE_HEAD
```

These commands are shown for review; the helper never executes them. Dispatch
requires the bootstrap workflow on main first. Its checkout does not persist
credentials. Fetches use the fixed same-repository HTTPS remote, and input strings
must have exact lowercase hexadecimal lengths. Dispatch concurrency is keyed by
tree so it cannot cancel the ordinary main CI run. The snapshot tag does not
match the existing push trigger, which accepts only the main branch.

The snapshot workflow reuses the existing setup, PostgreSQL 17 service,
PostgreSQL 16 server tools, `bun run gate`, and 14-day gate-log artifact policy.
There is no second check inventory. Trusted toolchain pins are preserved under
Git metadata and the verification helper outside the source workspace before
tracked files are replaced. Setup actions receive workspace-relative pin paths.
Normal
push/PR checks use the same pins and gate. The workflow has contents-read
permissions and no deployment credentials. No new upload/download service or
library is required.

## Public source, retention and cost

Publishing the tree exposes **all staged source bytes** through Git objects in a
public repository, even without an application commit. Deleting the temporary tag
does not promise erasure: fetched copies, forks and provider retention can remain.
Keep the snapshot tag until the passed tree is committed and pushed and its PR CI
is green. Record the run URL, tree and digest, then remove only that exact snapshot
tag. This cleanup is separate from the unchanged 14-day gate-log retention.
Never publish production data or credentials.

Git documents that [tags may point to any object](https://git-scm.com/docs/git-push#_push_rules),
and GitHub documents [tag targets of type tree](https://docs.github.com/en/rest/git/tags#create-a-tag-object).
The package has a local bare-repository transport proof, not a remote GitHub
publication proof. Actual same-provider push and dispatch remain approval-gated.

GitHub says [standard hosted-runner compute is free for public repositories](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
This does not establish unlimited artifact/cache storage. Account storage/quota
could not be verified (the attempted account endpoint returned 404); no remaining
allowance or spending authority is inferred. Existing log retention remains 14 days.
Larger hosted runners are not proposed.
