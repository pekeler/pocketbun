// PocketBun-only: validates the unavoidable version sources that cannot be
// collapsed because npm needs package.json and upstream sync uses pocketbase_tag.txt.

type PackageJson = {
  version?: unknown;
  engines?: { bun?: unknown };
  devDependencies?: { "@types/bun"?: unknown };
};

function fail(message: string): never {
  throw new Error(message);
}

const pocketbaseTag = (await Bun.file("pocketbase_tag.txt").text()).trim();
const tagMatch = pocketbaseTag.match(/^v([0-9]+\.[0-9]+\.[0-9]+)$/);
if (!tagMatch) {
  fail(`Invalid pocketbase_tag.txt value '${pocketbaseTag}'. Expected vX.Y.Z.`);
}

const packageJson = (await Bun.file("package.json").json()) as PackageJson;
if (typeof packageJson.version !== "string") {
  fail("Missing or invalid package.json version.");
}

const packageVersion = packageJson.version;
const versionMatch = packageVersion.match(/^([0-9]+\.[0-9]+\.[0-9]+)-pocketbun\.([0-9]+)$/);
if (!versionMatch) {
  fail(`Invalid package.json version '${packageVersion}'. Expected X.Y.Z-pocketbun.N.`);
}

const upstreamVersion = tagMatch[1];
const packageUpstreamVersion = versionMatch[1];
if (packageUpstreamVersion !== upstreamVersion) {
  fail(
    `Version mismatch: pocketbase_tag.txt targets ${pocketbaseTag}, but package.json version is ${packageVersion}. ` +
      `Expected package.json to start with ${upstreamVersion}-pocketbun.`,
  );
}

const bunEngine = packageJson.engines?.bun;
const bunEngineMatch = typeof bunEngine === "string" ? bunEngine.match(/^>=([0-9]+\.[0-9]+\.[0-9]+)$/) : null;
if (!bunEngineMatch) {
  fail(`Missing or invalid package.json engines.bun '${String(bunEngine)}'. Expected >=X.Y.Z.`);
}

const bunMinimum = bunEngineMatch[1];
const expectedBunEngine = `>=${bunMinimum}`;
if (packageJson.devDependencies?.["@types/bun"] !== `^${bunMinimum}`) {
  fail(`Expected package.json @types/bun to be ^${bunMinimum}.`);
}

for (const path of [
  "create-pocketbun/package.json",
  "create-pocketbun/template/simple/package.json",
  "examples/simple/package.json",
  "examples/advanced/package.json",
]) {
  const value = (await Bun.file(path).json()) as PackageJson;
  if (value.engines?.bun !== expectedBunEngine) {
    fail(`Expected ${path} engines.bun to be ${expectedBunEngine}.`);
  }
}

for (const path of [".github/workflows/ci.yml", ".github/workflows/cluster-runtime-qualification.yml"]) {
  const workflow = await Bun.file(path).text();
  const versions = [...workflow.matchAll(/bun-version:\s*([^\s]+)/g)].map((match) => match[1]);
  if (!versions.length || versions.some((version) => version !== bunMinimum)) {
    fail(`Expected every ${path} Bun pin to be ${bunMinimum}.`);
  }
}

const readme = await Bun.file("README.md").text();
if (!readme.includes(`PocketBun requires Bun \`v${bunMinimum}\` or newer.`)) {
  fail(`Expected README.md to require Bun v${bunMinimum}.`);
}

console.log(`Version sources are aligned: PocketBase ${pocketbaseTag}, PocketBun ${packageVersion}, Bun ${bunMinimum}`);
