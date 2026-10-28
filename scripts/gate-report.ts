import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface GateStepResult {
  readonly name: string;
  readonly ok: boolean;
  readonly seconds: number;
}

interface GateSource {
  readonly head: string;
  readonly indexTree: string;
  readonly trackedFilesMatchIndex: boolean;
  readonly untrackedFilesPresent: boolean;
}

export function gateSource(directory: string): GateSource {
  const git = (...args: readonly string[]) =>
    execFileSync("git", ["-C", directory, ...args], {
      encoding: "utf8",
    }).trim();
  const diff = spawnSync("git", ["-C", directory, "diff", "--quiet"]);
  if (diff.error) throw diff.error;
  if (diff.status !== 0 && diff.status !== 1)
    throw new Error("Cannot inspect gate source");
  return {
    head: git("rev-parse", "HEAD"),
    indexTree: git("write-tree"),
    trackedFilesMatchIndex: diff.status === 0,
    untrackedFilesPresent:
      git("ls-files", "--others", "--exclude-standard") !== "",
  };
}

function browserEvidence(
  directory: string,
  relative: string,
): readonly string[] {
  const path = join(directory, relative);
  if (!existsSync(path) || !lstatSync(path).isDirectory()) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) return browserEvidence(directory, child);
    if (
      entry.isFile() &&
      (entry.name === "trace.zip" ||
        entry.name === "error-context.md" ||
        /\.(png|webm)$/.test(entry.name))
    )
      return [child];
    return [];
  });
}

const evidenceLink = (path: string) => {
  const label = path.replace(/[[\]\\|\r\n]/g, "_");
  const target = path.split("/").map(encodeURIComponent).join("/");
  return `[${label}](${target})`;
};

/** Index existing evidence without copying log, inbox or trace contents. */
export function writeGateReport(input: {
  readonly directory: string;
  readonly source: ReturnType<typeof gateSource>;
  readonly ok: boolean;
  readonly seconds: number;
  readonly results: readonly GateStepResult[];
}) {
  const steps = input.results.map((step) => {
    const log = `${step.name}.log`;
    const browserReport = `${step.name}-report/index.html`;
    return {
      name: step.name,
      ok: step.ok,
      seconds: Math.round(step.seconds * 10) / 10,
      log: existsSync(join(input.directory, log)) ? log : null,
      evidence: [
        ...(existsSync(join(input.directory, browserReport))
          ? [browserReport]
          : []),
        ...browserEvidence(input.directory, `${step.name}-results`),
      ].sort(),
    };
  });
  const report = {
    version: 1,
    ok: input.ok,
    seconds: Math.round(input.seconds * 10) / 10,
    source: {
      head: input.source.head,
      indexTree: input.source.indexTree,
      trackedFilesMatchIndex: input.source.trackedFilesMatchIndex,
      untrackedFilesPresent: input.source.untrackedFilesPresent,
    },
    environment: { platform: process.platform, architecture: process.arch },
    rerun: "bun run gate",
    steps,
  };
  const failed = steps.filter((step) => !step.ok);
  const markdown = [
    `# Gate ${input.ok ? "passed" : "failed"}`,
    "",
    `HEAD: ${input.source.head}`,
    `Index tree: ${input.source.indexTree}`,
    `Tracked files match index: ${input.source.trackedFilesMatchIndex}; untracked files present: ${input.source.untrackedFilesPresent}.`,
    "The index tree identifies staged source; the flags expose working-tree differences.",
    "",
    `Duration: ${report.seconds}s. Environment: ${process.platform}/${process.arch}.`,
    "Rerun the complete isolated environment from the repository: `bun run gate`.",
    "Evidence paths are relative to this summary. Existing logs/reports contain assertion and scenario details.",
    "",
    ...(!input.ok && failed.length === 0
      ? [
          "Gate setup or orchestration failed; inspect the terminal/CI output.",
          "",
        ]
      : []),
    ...failed.flatMap((step) => [
      `## ${step.name} (${step.seconds}s)`,
      "",
      ...(step.log ? [`- ${evidenceLink(step.log)}`] : []),
      ...step.evidence.map((path) => `- ${evidenceLink(path)}`),
      "",
    ]),
    "## Completed stages",
    "",
    ...steps.map(
      (step) =>
        `- ${step.ok ? "PASS" : "FAIL"} ${step.name}: ${step.seconds}s${step.log ? ` — ${evidenceLink(step.log)}` : ""}`,
    ),
    "",
  ].join("\n");
  writeFileSync(
    join(input.directory, "summary.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(join(input.directory, "summary.md"), markdown);
  return report;
}
