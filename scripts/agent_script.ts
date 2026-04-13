#!/usr/bin/env bun
// PocketBun-only maintainer helper: stable no-arg wrapper for repeated local probes.
//
// Edit the config block below between runs, but keep the invoked command stable:
//   bun run agent-script

type AgentScriptConfig = {
  cmd: string[];
  cwd?: string;
  description: string;
  env?: Record<string, string | undefined>;
};

const config: AgentScriptConfig = {
  description: "Measure create-organizations-rule throughput over a fixed duration.",
  cmd: [
    "bun",
    "run",
    "scripts/measure_records_scenario.ts",
    "--scenario",
    "create-organizations-rule",
    "--duration-ms",
    "10000",
    "--concurrency",
    "100",
    "--warmup-requests",
    "100",
  ],
  cwd: process.cwd(),
  env: process.env,
};

console.log(config.description);
console.log(`cwd: ${config.cwd ?? process.cwd()}`);
console.log(`cmd: ${config.cmd.join(" ")}`);

const child = Bun.spawn({
  cmd: config.cmd,
  cwd: config.cwd ?? process.cwd(),
  env: config.env ?? process.env,
  stdio: ["inherit", "inherit", "inherit"],
});

const start = performance.now();
const exitCode = await child.exited;
const elapsedMs = performance.now() - start;
console.log(`agent-script elapsed: ${elapsedMs.toFixed(2)}ms`);
process.exit(exitCode);
