import {
  chmod,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { publishAssets } from "./publish-assets";

const temporaryDirectories: string[] = [];
const chunk = "workout-ABCDEFGH.js";
const release = "a".repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "fitness-assets-"));
  temporaryDirectories.push(root);
  const source = path.join(root, "source");
  const store = path.join(root, "store");
  await mkdir(source);
  await mkdir(store, { mode: 0o755 });
  await writeFile(path.join(source, chunk), "old lazy module");
  return { source, store, release };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("immutable production assets", () => {
  it("retains old modules across releases and records byte hashes outside assets", async () => {
    const input = await fixture();
    const first = await publishAssets(input);
    await rm(path.join(input.source, chunk));
    await writeFile(
      path.join(input.source, "workout-IJKLMNOP.js"),
      "new lazy module",
    );
    await publishAssets({ ...input, release: "b".repeat(40) });
    expect(
      await readFile(path.join(input.store, "assets", chunk), "utf8"),
    ).toBe("old lazy module");
    expect(await readdir(path.join(input.store, "assets"))).toEqual([
      chunk,
      "workout-IJKLMNOP.js",
    ]);
    const manifests = await readdir(path.join(input.store, "manifests"));
    expect(manifests).toHaveLength(2);
    expect(first.assets[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (await lstat(path.join(input.store, "assets", chunk))).mode & 0o777,
    ).toBe(0o644);
    expect(
      (await lstat(path.join(input.store, "manifests"))).mode & 0o777,
    ).toBe(0o700);
    expect(await readdir(input.store)).toEqual(["assets", "manifests"]);
  });

  it("fails before publishing a release that conflicts with an immutable name", async () => {
    const input = await fixture();
    await publishAssets(input);
    await writeFile(path.join(input.source, chunk), "changed bytes");
    await writeFile(path.join(input.source, "new-ABCDEFGH.css"), "body{}");
    await expect(publishAssets(input)).rejects.toThrow("Asset collision");
    expect(
      await readFile(path.join(input.store, "assets", chunk), "utf8"),
    ).toBe("old lazy module");
    expect(await readdir(path.join(input.store, "assets"))).toEqual([chunk]);
    expect(await readdir(path.join(input.store, "manifests"))).toHaveLength(1);
  });

  it.each(["symlink", "hardlink", "directory", "unhashed", "empty"])(
    "rejects %s input before publishing any assets",
    async (kind) => {
      const input = await fixture();
      if (kind === "symlink")
        await symlink(
          path.join(input.source, chunk),
          path.join(input.source, "link-ABCDEFGH.js"),
        );
      if (kind === "hardlink")
        await link(
          path.join(input.source, chunk),
          path.join(input.source, "link-ABCDEFGH.js"),
        );
      if (kind === "directory")
        await mkdir(path.join(input.source, "nested-ABCDEFGH.js"));
      if (kind === "unhashed")
        await writeFile(
          path.join(input.source, "index.html"),
          "private document",
        );
      if (kind === "empty") await rm(path.join(input.source, chunk));
      await expect(publishAssets(input)).rejects.toThrow();
      expect(await readdir(input.store)).toEqual([]);
    },
  );

  it("rejects a writable or symlinked store and symlinked immutable destinations", async () => {
    const input = await fixture();
    await chmod(input.store, 0o777);
    await expect(publishAssets(input)).rejects.toThrow(
      "Unsafe retained directory",
    );
    await rm(input.store, { recursive: true });
    await symlink(input.source, input.store);
    await expect(publishAssets(input)).rejects.toThrow(
      "Unsafe retained directory",
    );
    await rm(input.store);
    await mkdir(input.store, { mode: 0o755 });
    await publishAssets(input);
    await rm(path.join(input.store, "assets", chunk));
    await symlink(
      path.join(input.source, chunk),
      path.join(input.store, "assets", chunk),
    );
    await expect(publishAssets(input)).rejects.toThrow();
  });

  it("requires an existing store instead of creating an ephemeral replacement", async () => {
    const input = await fixture();
    await rm(input.store, { recursive: true });
    await expect(publishAssets(input)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(lstat(input.store)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects existing bytes that Caddy cannot read", async () => {
    const input = await fixture();
    await publishAssets(input);
    await chmod(path.join(input.store, "assets", chunk), 0o600);
    await expect(publishAssets(input)).rejects.toThrow("Unsafe asset");
    expect(await readdir(path.join(input.store, "manifests"))).toHaveLength(1);
  });

  it("allows concurrent identical publishers without overwrites or staging leftovers", async () => {
    const input = await fixture();
    await Promise.all([
      publishAssets(input),
      publishAssets(input),
      publishAssets(input),
    ]);
    expect(
      await readFile(path.join(input.store, "assets", chunk), "utf8"),
    ).toBe("old lazy module");
    expect(await readdir(input.store)).toEqual(["assets", "manifests"]);
    expect(await readdir(path.join(input.store, "manifests"))).toHaveLength(3);
  });

  it("lets only one conflicting concurrent release publish a manifest", async () => {
    const input = await fixture();
    const otherSource = path.join(path.dirname(input.source), "other-source");
    await mkdir(otherSource);
    await writeFile(path.join(otherSource, chunk), "different content");
    const results = await Promise.allSettled([
      publishAssets(input),
      publishAssets({ ...input, source: otherSource }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(await readdir(path.join(input.store, "manifests"))).toHaveLength(1);
    expect(await readdir(input.store)).toEqual(["assets", "manifests"]);
  });
});
