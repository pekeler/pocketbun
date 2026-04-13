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
  description: "Measure the slow create-organizations benchmark path without inspector overhead.",
  cmd: [
    "bun",
    "run",
    "scripts/measure_records_scenario.ts",
    "--scenario",
    "create-organizations",
    "--duration-ms",
    "10000",
    "--concurrency",
    "10",
    "--warmup-requests",
    "500",
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

const exitCode = await child.exited;
process.exit(exitCode);
