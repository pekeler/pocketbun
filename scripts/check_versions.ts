// PocketBun-only: validates the unavoidable version sources that cannot be
// collapsed because npm needs package.json and upstream sync uses pocketbase_tag.txt.

type PackageJson = {
  version?: unknown;
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

console.log(`Version sources are aligned: PocketBase ${pocketbaseTag}, PocketBun ${packageVersion}`);
