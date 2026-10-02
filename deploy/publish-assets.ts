import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const assetName = /^[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|svg|jpg|webp)$/;
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const hasCode = (error: unknown, code: string) =>
  error instanceof Error && "code" in error && error.code === code;

type PublishedAssets = Readonly<{
  release: string;
  publishedAt: string;
  assets: readonly Readonly<{ name: string; sha256: string }>[];
}>;

async function ensureDirectory(directory: string, mode: number, create = true) {
  if (create) {
    try {
      await mkdir(directory, { mode });
    } catch (error) {
      if (!hasCode(error, "EEXIST")) throw error;
    }
  }
  const stat = await lstat(directory);
  if (
    !stat.isDirectory() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o777) !== mode
  ) {
    throw new Error(`Unsafe retained directory: ${directory}`);
  }
}

async function regularBytes(file: string, owned = false) {
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const stat = await handle.stat();
    if (
      !stat.isFile() ||
      (owned &&
        (stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o644))
    ) {
      throw new Error(`Unsafe asset: ${file}`);
    }
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function verifyExisting(
  file: string,
  expectedHash: string,
  allowMissing = false,
) {
  try {
    if (hash(await regularBytes(file, true)) !== expectedHash)
      throw new Error(`Asset collision: ${file}`);
  } catch (error) {
    if (!(allowMissing && hasCode(error, "ENOENT"))) throw error;
  }
}

async function stagedFile(file: string, bytes: Uint8Array) {
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function publishAssets(
  input: Readonly<{ source: string; store: string; release: string }>,
): Promise<PublishedAssets> {
  const names = (await readdir(input.source)).sort();
  if (names.length === 0 || names.some((name) => !assetName.test(name)))
    throw new Error("Expected flat fingerprinted assets");
  const sourceStat = await lstat(input.source);
  if (!sourceStat.isDirectory()) throw new Error("Expected an asset directory");
  const files = await Promise.all(
    names.map(async (name) => {
      const file = path.join(input.source, name);
      const stat = await lstat(file);
      if (!stat.isFile() || stat.nlink !== 1)
        throw new Error(`Expected a regular asset: ${name}`);
      const bytes = await regularBytes(file);
      return { name, bytes, sha256: hash(bytes) };
    }),
  );

  await ensureDirectory(input.store, 0o755, false);
  const assets = path.join(input.store, "assets");
  const manifests = path.join(input.store, "manifests");
  await ensureDirectory(assets, 0o755);
  await ensureDirectory(manifests, 0o700);
  await Promise.all(
    files.map((file) =>
      verifyExisting(path.join(assets, file.name), file.sha256, true),
    ),
  );

  const staging = await mkdtemp(path.join(input.store, ".publish-"));
  try {
    for (const file of files) {
      const staged = path.join(staging, file.name);
      await stagedFile(staged, file.bytes);
      if (hash(await regularBytes(staged)) !== file.sha256)
        throw new Error(`Copy verification failed: ${file.name}`);
      await chmod(staged, 0o644);
    }
    for (const file of files) {
      try {
        await link(path.join(staging, file.name), path.join(assets, file.name));
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
      }
      await verifyExisting(path.join(assets, file.name), file.sha256);
    }
    const manifest = {
      release: input.release,
      publishedAt: new Date().toISOString(),
      assets: files.map(({ name, sha256 }) => ({ name, sha256 })),
    };
    const stagedManifest = path.join(staging, "manifest.json");
    await stagedFile(
      stagedManifest,
      Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
    );
    await link(stagedManifest, path.join(manifests, `${randomUUID()}.json`));
    for (const directory of [assets, manifests, input.store]) {
      const handle = await open(
        directory,
        constants.O_RDONLY | constants.O_DIRECTORY,
      );
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    return manifest;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  if (process.getuid?.() !== 0)
    throw new Error("Asset publication requires root before dropping to bun");
  const mounts = await readFile("/proc/self/mountinfo", "utf8");
  if (
    !mounts
      .split("\n")
      .some((line) => line.split(" ")[4] === "/retained-production")
  )
    throw new Error(
      "The persistent production store must be mounted at /retained-production",
    );
  const release = z
    .string()
    .regex(/^(unknown|[a-f0-9]{40})$/)
    .parse(process.env.GIT_SHA ?? "unknown");
  const manifest = await publishAssets({
    source: "/app/build/client/assets",
    store: "/retained-production",
    release,
  });
  console.info(
    `Published ${manifest.assets.length} immutable assets before startup`,
  );
}
