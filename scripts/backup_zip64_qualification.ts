// PocketBun-only: repeatable Linux qualification for large streaming backup/restore.

import { Database } from "bun:sqlite";
import { open, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { newTestApp } from "../src/tests/app.ts";

const blobBytes = 64 * 1024 * 1024;
const blobRows = 65;
const fileName = "backup-qualification.bin";
const before = "before-backup";
const after = "after-backup";

const started = performance.now();
await using fixture = await newTestApp();
const { app } = fixture;

app.db().run("create table if not exists _pb_backup_zip64_probe (id integer primary key, value text, payload blob)");
for (let i = 0; i < blobRows; i += 1)
  app.db().run("insert into _pb_backup_zip64_probe (value, payload) values (?, zeroblob(?))", [before, blobBytes]);
app
  .auxDb()
  .run("insert into _logs (id, level, message, data, created) values (?, 0, ?, '{}', strftime('%Y-%m-%d %H:%M:%fZ'))", [
    "zip64backup0001",
    before,
  ]);
const originalFile = randomBytes(1024 * 1024);
const originalFileCrc = Bun.hash.crc32(originalFile);
await writeFile(join(app.dataDir(), fileName), originalFile);

const backupStarted = performance.now();
const backupError = await app.CreateBackup({}, "zip64-qualification.zip");
if (backupError) throw backupError;
const backupMs = performance.now() - backupStarted;
const archivePath = join(app.dataDir(), "backups", "zip64-qualification.zip");
const archiveSize = (await stat(archivePath)).size;
if (archiveSize >= blobBytes * blobRows) throw new Error(`backup was not compressed: ${archiveSize} bytes`);
if (!(await hasZip64Entry(archivePath, "data.db", blobBytes * blobRows))) {
  throw new Error("backup data.db entry is missing ZIP64 size metadata");
}
console.log(JSON.stringify({ phase: "backup", archiveSize, backupMs, rss: process.memoryUsage().rss }));

app.db().run("update _pb_backup_zip64_probe set value = ? where id = 1", [after]);
app.auxDb().run("update _logs set message = ? where id = ?", [after, "zip64backup0001"]);
await writeFile(join(app.dataDir(), fileName), after);

// The qualification process must remain alive after restore rather than execing itself.
(app as unknown as { RestartAsync: () => Promise<Error | null> }).RestartAsync = async () => null;
const restoreStarted = performance.now();
const restoreError = await app.RestoreBackup({}, "zip64-qualification.zip");
if (restoreError) throw restoreError;
const restoreMs = performance.now() - restoreStarted;
app.resetBootstrapState();
app.bootstrap();

const restoredMain = app.db().query("select value from _pb_backup_zip64_probe where id = 1").get() as { value: string };
const restoredAux = app.auxDb().query("select message from _logs where id = ?").get("zip64backup0001") as { message: string };
if (
  restoredMain.value !== before ||
  restoredAux.message !== before ||
  Bun.hash.crc32(await readFile(join(app.dataDir(), fileName))) !== originalFileCrc
) {
  throw new Error("restore did not replace main DB, auxiliary DB, and file state");
}
for (const path of [join(app.dataDir(), "data.db"), join(app.dataDir(), "auxiliary.db")]) {
  using db = new Database(path, { readonly: true });
  const result = db.query("pragma integrity_check").get() as { integrity_check: string };
  if (result.integrity_check !== "ok") throw new Error(`${path} integrity check failed`);
}
console.log(
  JSON.stringify({
    blobBytes,
    blobRows,
    archiveSize,
    backupMs,
    restoreMs,
    elapsedMs: performance.now() - started,
    rss: process.memoryUsage().rss,
  }),
);

async function hasZip64Entry(path: string, name: string, minimumSize: number): Promise<boolean> {
  await using file = await open(path, "r");
  const size = (await file.stat()).size;
  const tail = new Uint8Array(Math.min(size, 65_600));
  await file.read(tail, 0, tail.length, size - tail.length);
  const eocdOffset = findSignature(tail, 0x06054b50);
  if (eocdOffset < 0) return false;
  const eocd = new DataView(tail.buffer, tail.byteOffset + eocdOffset, 22);
  let offset = eocd.getUint32(16, true);
  for (let i = 0; i < eocd.getUint16(10, true); i += 1) {
    const header = await readAt(file, 46, offset);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (view.getUint32(0, true) !== 0x02014b50) return false;
    const nameLength = view.getUint16(28, true);
    const extraLength = view.getUint16(30, true);
    const commentLength = view.getUint16(32, true);
    const tail = await readAt(file, nameLength + extraLength + commentLength, offset + 46);
    if (new TextDecoder().decode(tail.slice(0, nameLength)) === name) {
      if (view.getUint32(24, true) !== 0xffffffff) return false;
      return zip64UncompressedSize(tail.slice(nameLength, nameLength + extraLength)) >= minimumSize;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return false;
}

async function readAt(file: Awaited<ReturnType<typeof open>>, size: number, position: number): Promise<Uint8Array> {
  const data = new Uint8Array(size);
  let offset = 0;
  while (offset < size) {
    const result = await file.read(data, offset, size - offset, position + offset);
    if (result.bytesRead === 0) throw new Error("unexpected end of ZIP file");
    offset += result.bytesRead;
  }
  return data;
}

function findSignature(data: Uint8Array, signature: number): number {
  for (let i = data.length - 4; i >= 0; i -= 1) {
    if (new DataView(data.buffer, data.byteOffset + i, 4).getUint32(0, true) === signature) return i;
  }
  return -1;
}

function zip64UncompressedSize(extra: Uint8Array): number {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const view = new DataView(extra.buffer, extra.byteOffset + offset, extra.length - offset);
    const size = view.getUint16(2, true);
    if (offset + 4 + size > extra.length) return 0;
    if (view.getUint16(0, true) === 0x0001 && size >= 8) return Number(view.getBigUint64(4, true));
    offset += 4 + size;
  }
  return 0;
}

function randomBytes(size: number): Uint8Array {
  const result = new Uint8Array(size);
  for (let offset = 0; offset < result.length; offset += 65_536)
    crypto.getRandomValues(result.subarray(offset, offset + 65_536));
  return result;
}
