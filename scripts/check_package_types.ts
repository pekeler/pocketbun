// PocketBun-only: verifies generated package declarations from a consumer project.

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const distIndexDts = resolve(root, "dist", "index.d.ts");
if (!(await exists(distIndexDts))) {
  throw new Error("Missing dist/index.d.ts. Run `bun run build` before checking package types.");
}

const fixtureRoot = resolve(root, ".tmp", "package-types-consumer");
const packageRoot = join(fixtureRoot, "node_modules", "pocketbun");

await rm(fixtureRoot, { recursive: true, force: true });
await mkdir(packageRoot, { recursive: true });
await cp(resolve(root, "dist"), join(packageRoot, "dist"), { recursive: true });
await cp(resolve(root, "package.json"), join(packageRoot, "package.json"));

await writeFile(join(fixtureRoot, "package.json"), JSON.stringify({ type: "module", private: true }, null, 2) + "\n");
await writeFile(
  join(fixtureRoot, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        noEmit: true,
        types: ["bun"],
      },
      include: ["index.ts"],
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  join(fixtureRoot, "index.ts"),
  [
    'import { BaseApp, PocketBase, Record, TextField, NumberField, BoolField, URLField, EmailField, EditorField, PasswordField, DateField, AutodateField, JSONField, RelationField, SelectField, FileField, GeoPointField, bindCore, type CoreBindings, Collection, newCollection, newBaseCollection, newAuthCollection, newViewCollection, serveAsync, type CollectionInit, type PocketBaseConfig } from "pocketbun";',
    "",
    "const config: PocketBaseConfig = { DefaultDev: true };",
    "const pb = new PocketBase(config);",
    "const app = new BaseApp({ dataDir: 'pb_data' });",
    "const collectionConfig: CollectionInit = { name: 'media', type: 'base' };",
    "const collections: Collection[] = [new Collection(collectionConfig), newCollection('base', 'media'), newBaseCollection('media'), newAuthCollection('members'), newViewCollection('stats')];",
    "collections[0]!.fields.addMarshaledJSON(JSON.stringify([{ name: 'title', type: 'text', required: true }]));",
    "void app.save(collections[0]!);",
    "const title: TextField = new TextField({ name: 'title', required: true, max: 255 });",
    "title.max = 512;",
    "title.setHidden(true);",
    "const hidden: boolean = title.getHidden();",
    "void hidden;",
    "const view = new Collection({ name: 'titles', type: 'view', viewQuery: 'SELECT id, title FROM media' });",
    "const auth = new Collection({ name: 'members', type: 'auth', passwordAuth: { enabled: true } });",
    "void [view, auth];",
    "collections[0]!.fields.add(title, new NumberField({ name: 'year', onlyInt: true }), new AutodateField({ name: 'created', onCreate: true }));",
    "const record = new Record(collections[0]!, { title: 'Example' });",
    "record.set('year', 2026);",
    "void app.save(record);",
    "const core: CoreBindings = bindCore({});",
    "core.newBaseCollection('bound').fields.add(new core.TextField({ name: 'title', max: 255 }));",
    "const bound = new core.Record(collections[0]!);",
    "bound.set('title', 'Bound');",
    "const retained = bindCore({ label: 'existing' });",
    "const label: string = retained.label;",
    "void label;",
    "void [new BoolField({ required: true }), new URLField({ onlyDomains: ['example.com'] }), new EmailField({ exceptDomains: ['example.com'] }), new EditorField({ maxSize: 1024 }), new PasswordField({ min: 8 }), new DateField({ name: 'date' }), new JSONField({ maxSize: 1024 }), new RelationField({ collectionId: 'collection', maxSelect: 1 }), new SelectField({ values: ['one'], maxSelect: 1 }), new FileField({ mimeTypes: ['image/png'], maxSize: 1024 }), new GeoPointField({ required: true })];",
    "// @ts-expect-error field options must retain their value types",
    "new TextField({ max: 'invalid' });",
    "// @ts-expect-error constructor options cannot overwrite field methods",
    "new NumberField({ Type: () => 'text' });",
    "// @ts-expect-error bound constructors also reject invalid options",
    "new core.AutodateField({ onCreate: 'invalid' });",
    "void serveAsync(app, { httpAddr: '127.0.0.1:0' });",
    "void pb;",
    "",
  ].join("\n"),
);

const proc = Bun.spawn({
  cmd: ["bun", "x", "tsc", "-p", join(fixtureRoot, "tsconfig.json")],
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;
if (exitCode !== 0) {
  process.exit(exitCode ?? 1);
}

async function exists(path: string): Promise<boolean> {
  try {
    await Bun.file(path).bytes();
    return true;
  } catch {
    return false;
  }
}
