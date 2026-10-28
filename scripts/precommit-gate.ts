import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const git = (cwd: string, args: readonly string[], env = process.env) =>
  execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", env }).trim();

/** Test staged source without touching unstaged or untracked work. */
export function precommitGate(root: string): void {
  const tree = git(root, ["write-tree"]);
  const head = git(root, ["rev-parse", "HEAD"]);
  const foreignEnv: NodeJS.ProcessEnv = { ...process.env, HUSKY: "0" };
  for (const name of git(root, ["rev-parse", "--local-env-vars"]).split("\n"))
    delete foreignEnv[name];
  const temporary = mkdtempSync(join(tmpdir(), "fitness-precommit-"));
  const checkout = join(temporary, "source");
  const started = performance.now();
  try {
    git(
      root,
      ["clone", "--quiet", "--shared", "--no-checkout", root, checkout],
      foreignEnv,
    );
    git(checkout, ["checkout", "--quiet", "--detach", head], foreignEnv);
    git(checkout, ["read-tree", "--reset", "-u", tree], foreignEnv);
    for (const args of [
      ["install", "--frozen-lockfile"],
      ["run", "gate"],
    ]) {
      const result = spawnSync("bun", args, {
        cwd: checkout,
        env: foreignEnv,
        stdio: "inherit",
      });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`bun ${args.join(" ")} failed`);
    }
    if (git(checkout, ["write-tree"], foreignEnv) !== tree)
      throw new Error("Gate changed its staged source");
    git(checkout, ["diff", "--exit-code"], foreignEnv);
    if (
      git(root, ["write-tree"]) !== tree ||
      git(root, ["rev-parse", "HEAD"]) !== head
    )
      throw new Error(
        "Index or HEAD changed during the gate; run commit again",
      );
    console.log(
      `Precommit gate passed for ${tree} (${Math.round((performance.now() - started) / 1000)}s)`,
    );
  } finally {
    try {
      if (existsSync(join(checkout, ".gate"))) {
        const destination = join(root, ".gate", "precommit");
        rmSync(destination, { recursive: true, force: true });
        cpSync(join(checkout, ".gate"), destination, { recursive: true });
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
}

if (import.meta.main) {
  try {
    precommitGate(git(process.cwd(), ["rev-parse", "--show-toplevel"]));
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Precommit gate failed",
    );
    process.exitCode = 1;
  }
}
