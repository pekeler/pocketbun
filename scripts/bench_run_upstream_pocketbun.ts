// PocketBun-only: runs a PocketBun-native port of the upstream pocketbase/benchmarks app.

import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { MustRegisterJSVM, NewWithConfig, serve } from "../index.ts";
import { CollectionNameSuperusers } from "../src/core/collection_model.ts";
import { NewRecord } from "../src/core/record_model.ts";
import { registerBenchmarkModule } from "./bench_upstream_pocketbun/module.ts";
import { benchmarkSchema } from "./bench_upstream_pocketbun/schema.ts";

const benchmarkRunOverrideFile = process.env.POCKETBUN_BENCHMARK_RUN_FILE ?? "/tmp/pocketbun-bench-upstream-run.txt";
const benchmarkRun = await resolveBenchmarkRun(benchmarkRunOverrideFile);
const machineTag = sanitizeTag(process.env.POCKETBUN_BENCH_MACHINE_TAG ?? "m2-max");
const timestampTag = createTimestampTag(new Date());
const resultsDir = process.env.POCKETBUN_BENCH_RESULTS_DIR ?? "benchmarks/results";
const repoResultFile =
  process.env.POCKETBUN_BENCHMARK_RESULT_FILE ??
  join(resultsDir, `${timestampTag}-pocketbun-upstream-${machineTag}.md`);
const latestResultFile = process.env.POCKETBUN_BENCHMARK_RESULT_LATEST_FILE ?? "/tmp/pocketbun-benchmarks-latest.txt";

const serverReadyTimeoutMs = 60_000;
const benchmarkTimeoutMs = 120 * 60_000;
const pollIntervalMs = 5_000;
const probePassword = "1234567890";
const probeUserEmail = "users0@example.com";
const probeUserUsername = "users0";

const hooksDir = fileURLToPath(new URL("../vendor/pocketbase-benchmarks/pb_hooks", import.meta.url));
const port = await pickPort();
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), "pocketbun-benchmarks-"));

const app = NewWithConfig({
  HideStartBanner: true,
  DefaultDataDir: dataDir,
  DefaultQueryTimeout: 120,
});

MustRegisterJSVM(app, {
  HooksPoolSize: 50,
  HooksDir: hooksDir,
});
registerBenchmarkModule(app, baseUrl);
if (!app.isBootstrapped()) {
  app.bootstrap();
}
app.runAllMigrations();
await ensureDefaultSuperuser();

const server = serve(app, { httpAddr: `127.0.0.1:${port}` });

try {
  await ensureServerReady();

  const runNames = benchmarkRun
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  if (runNames.includes("auth") && !runNames.includes("create")) {
    const token = await authSuperuser();
    await importProbeSchema(token);
    await ensureProbeAuthIdentity(token);
  }

  const trigger = await fetch(`${baseUrl}/benchmarks?run=${encodeURIComponent(benchmarkRun)}`);
  if (!trigger.ok) {
    throw new Error(`failed to start PocketBun upstream benchmarks: HTTP ${trigger.status}`);
  }

  const triggerText = (await trigger.text()).trim();
  console.log(`\nPocketBun benchmark trigger response: ${triggerText}`);
  console.log(`Waiting for completion (run=${benchmarkRun})...`);

  const token = await authSuperuser();
  const result = await waitForBenchmarkResult(token);

  console.log("\nPocketBun upstream benchmark result");
  console.log(`  tests: ${String(result.tests ?? "")}`);
  if (typeof result.error === "string" && result.error !== "") {
    console.log(`  error: ${result.error}`);
    throw new Error(`PocketBun benchmark reported error: ${result.error}`);
  }
  console.log("  status: completed");
  console.log("\nResult body:");
  const resultBody = String(result.result ?? "").trim();
  console.log(resultBody || "(empty)");

  const metadataHeader = [
    "# PocketBun Upstream-Port Benchmark Result",
    "",
    `- machine: ${machineTag}`,
    `- timestamp: ${new Date().toISOString()}`,
    `- tests: ${benchmarkRun}`,
    "",
  ].join("\n");

  await mkdir(dirname(repoResultFile), { recursive: true });
  await writeFile(repoResultFile, `${metadataHeader}${resultBody}\n`);

  await mkdir(dirname(latestResultFile), { recursive: true });
  await writeFile(latestResultFile, `${resultBody}\n`);

  console.log(`\nSaved full result to: ${repoResultFile}`);
  console.log(`Saved latest raw result to: ${latestResultFile}`);
} finally {
  await server.stop();
  app.resetBootstrapState();
  await rm(dataDir, { recursive: true, force: true });
}

function createTimestampTag(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z");
}

function sanitizeTag(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
}

async function resolveBenchmarkRun(overrideFile: string): Promise<string> {
  const envRun = process.env.POCKETBUN_BENCHMARK_RUN?.trim();
  if (envRun) {
    return envRun;
  }

  try {
    const raw = await readFile(overrideFile, "utf8");
    const firstNonCommentLine = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "" && !line.startsWith("#"));

    if (firstNonCommentLine) {
      console.log(`Using benchmark run override from ${overrideFile}: ${firstNonCommentLine}`);
      return firstNonCommentLine;
    }
  } catch (error) {
    const errno = error as NodeJS.ErrnoException;
    if (errno.code !== "ENOENT") {
      throw error;
    }
  }

  return "create,auth,search,custom,delete";
}

async function ensureServerReady(): Promise<void> {
  const deadline = Date.now() + serverReadyTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // retry
    }

    await delay(250);
  }

  throw new Error("PocketBun benchmark server did not become ready in time");
}

async function authSuperuser(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identity: "test@example.com",
      password: "1234567890",
    }),
  });

  if (!response.ok) {
    throw new Error(`superuser auth failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { token?: string };
  const token = payload.token ?? "";
  if (!token) {
    throw new Error("superuser auth response missing token");
  }

  return token;
}

type ProbeAuthIdentity = {
  id: string;
  email: string;
  password: string;
};

async function ensureProbeAuthIdentity(superuserToken: string): Promise<ProbeAuthIdentity> {
  const usersResponse = await fetch(`${baseUrl}/api/collections/users/records?perPage=200&fields=id,email`, {
    headers: { Authorization: superuserToken },
  });
  if (!usersResponse.ok) {
    throw new Error(`failed to fetch users for probe: HTTP ${usersResponse.status}`);
  }
  const usersPayload = (await usersResponse.json()) as { items?: Array<{ id?: string; email?: string }> };
  const existingUser = usersPayload.items?.find((item) => item.email === probeUserEmail);
  if (existingUser?.id && existingUser.email) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      password: probePassword,
    };
  }

  const probeOrganizationName = `probe-org-${Date.now()}`;
  const createOrganizationResponse = await fetch(`${baseUrl}/api/collections/organizations/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: probeOrganizationName,
    }),
  });
  if (!createOrganizationResponse.ok) {
    const body = compactErrorSample(await createOrganizationResponse.text());
    throw new Error(`failed to create probe organization: HTTP ${createOrganizationResponse.status} ${body}`);
  }
  const createdOrganization = (await createOrganizationResponse.json()) as { id?: string };
  if (!createdOrganization.id) {
    throw new Error("failed to read created probe organization id");
  }

  const probePermissionName = `probe-perm-${Date.now()}`;
  const createPermissionResponse = await fetch(`${baseUrl}/api/collections/permissions/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: probePermissionName,
      active: true,
    }),
  });
  if (!createPermissionResponse.ok) {
    const body = compactErrorSample(await createPermissionResponse.text());
    throw new Error(`failed to create probe permission: HTTP ${createPermissionResponse.status} ${body}`);
  }
  const createdPermission = (await createPermissionResponse.json()) as { id?: string };
  if (!createdPermission.id) {
    throw new Error("failed to read created probe permission id");
  }

  const createUserResponse = await fetch(`${baseUrl}/api/collections/users/records`, {
    method: "POST",
    headers: {
      Authorization: superuserToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: probeUserEmail,
      username: probeUserUsername,
      organization: createdOrganization.id,
      permissions: [createdPermission.id],
      password: probePassword,
      passwordConfirm: probePassword,
    }),
  });
  if (!createUserResponse.ok) {
    const body = compactErrorSample(await createUserResponse.text());
    throw new Error(`failed to create probe user: HTTP ${createUserResponse.status} ${body}`);
  }
  const createdUser = (await createUserResponse.json()) as { id?: string; email?: string };
  if (!createdUser.id || !createdUser.email) {
    throw new Error("failed to read created probe user");
  }

  return {
    id: createdUser.id,
    email: createdUser.email,
    password: probePassword,
  };
}

async function importProbeSchema(token: string): Promise<void> {
  const importResponse = await fetch(`${baseUrl}/api/collections/import`, {
    method: "PUT",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deleteMissing: true,
      collections: JSON.parse(benchmarkSchema) as unknown[],
    }),
  });

  if (!importResponse.ok) {
    const body = compactErrorSample(await importResponse.text());
    throw new Error(`failed to import probe schema: HTTP ${importResponse.status} ${body}`);
  }
}

function compactErrorSample(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function ensureDefaultSuperuser(): Promise<void> {
  if (app.CountRecords(CollectionNameSuperusers) > 0) {
    return;
  }

  const superusersCollection = app.FindCollectionByNameOrId(CollectionNameSuperusers);
  const superuser = NewRecord(superusersCollection);
  superuser.Set("email", "test@example.com");
  superuser.Set("password", "1234567890");

  const saveErr = await app.Save(superuser);
  if (saveErr) {
    throw new Error(`failed to create benchmark superuser: ${saveErr.message}`);
  }
}

async function waitForBenchmarkResult(token: string): Promise<{ tests?: unknown; result?: unknown; error?: unknown }> {
  const deadline = Date.now() + benchmarkTimeoutMs;

  while (Date.now() < deadline) {
    const response = await fetch(`${baseUrl}/api/collections/benchmarks/records?sort=-created&perPage=1`, {
      headers: {
        Authorization: token,
      },
    });

    if (response.ok) {
      const payload = (await response.json()) as {
        items?: Array<{ tests?: unknown; result?: unknown; error?: unknown }>;
      };

      const latest = payload.items?.[0];
      if (latest && latest.tests === benchmarkRun) {
        return latest;
      }
    }

    await delay(pollIntervalMs);
  }

  throw new Error("timed out waiting for PocketBun benchmark completion");
}

async function pickPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      const selected = address.port;
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(selected);
      });
    });
  });
}
