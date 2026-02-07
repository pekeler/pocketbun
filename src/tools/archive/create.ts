// Ported from pocketbase/tools/archive/create.go

import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, relative } from "node:path";
import { deflateRawSync } from "node:zlib";

const textEncoder = new TextEncoder();
const crcTable = buildCrcTable();

// Create creates a new zip archive from src dir content and saves it in dest path.
//
// You can specify skipPaths to skip/ignore certain directories and files (relative to src)
// preventing adding them in the final archive.
export function Create(src: string, dest: string, ...skipPaths: string[]): void {
  mkdirSync(dirname(dest), { recursive: true });

  try {
    const files = collectFilesSync(src, skipPaths);
    const zip = buildZip(files);
    writeFileSync(dest, zip);
  } catch (error) {
    try {
      rmSync(dest, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

// CreateAsync is PocketBun-only async alternative to Create.
//
// It preserves the same behavior while avoiding synchronous filesystem I/O.
export async function CreateAsync(src: string, dest: string, ...skipPaths: string[]): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });

  try {
    const files = await collectFilesAsync(src, skipPaths);
    const zip = buildZip(files);
    await writeFile(dest, zip);
  } catch (error) {
    try {
      await rm(dest, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

type ZipEntry = {
  name: string;
  data: Uint8Array;
  modTime: Date;
  mode: number;
};

// note remove after similar method is added in the std lib (https://github.com/golang/go/issues/54898)
function collectFilesSync(src: string, skipPaths: string[]): ZipEntry[] {
  const entries: ZipEntry[] = [];

  const walk = (dir: string) => {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        walk(fullPath);
        continue;
      }

      const rel = normalizeRelPath(relative(src, fullPath));
      if (shouldSkip(rel, skipPaths)) {
        continue;
      }

      const info = lstatSync(fullPath);
      const data = readFileSync(fullPath);

      entries.push({
        name: rel,
        data: new Uint8Array(data),
        modTime: info.mtime,
        mode: info.mode,
      });
    }
  };

  walk(src);
  return entries;
}

async function collectFilesAsync(src: string, skipPaths: string[]): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];

  const walk = async (dir: string): Promise<void> => {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const rel = normalizeRelPath(relative(src, fullPath));
      if (shouldSkip(rel, skipPaths)) {
        continue;
      }

      const [info, data] = await Promise.all([lstat(fullPath), readFile(fullPath)]);

      entries.push({
        name: rel,
        data: new Uint8Array(data),
        modTime: info.mtime,
        mode: info.mode,
      });
    }
  };

  await walk(src);
  return entries;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const writer = new ChunkWriter();
  const central = new ChunkWriter();

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const localHeaderOffset = writer.length;

    const { date, time } = toDosDateTime(entry.modTime);
    const extra = buildExtendedTimestampExtra(entry.modTime);
    const crc = crc32(entry.data);
    const compressed =
      entry.data.length === 0 ? deflateRawSync(entry.data, { level: 0 }) : deflateRawSync(entry.data, { level: 1 });
    const flags = 0x08;

    writer.push(
      buildLocalHeader({
        flags,
        time,
        date,
        crc: 0,
        compressedSize: 0,
        uncompressedSize: 0,
        nameLength: nameBytes.length,
        extraLength: extra.length,
      }),
    );
    writer.push(nameBytes);
    writer.push(extra);
    writer.push(compressed);
    writer.push(buildDataDescriptor(crc, compressed.length, entry.data.length));

    central.push(
      buildCentralHeader({
        flags,
        time,
        date,
        crc,
        compressedSize: compressed.length,
        uncompressedSize: entry.data.length,
        nameLength: nameBytes.length,
        extraLength: extra.length,
        externalAttrs: (entry.mode & 0xffff) << 16,
        localHeaderOffset,
      }),
    );
    central.push(nameBytes);
    central.push(extra);
  }

  const centralOffset = writer.length;
  writer.push(central.concat());

  writer.push(
    buildEndOfCentralDirectory({
      entries: entries.length,
      centralSize: central.length,
      centralOffset,
    }),
  );

  return writer.concat();
}

type HeaderInput = {
  flags: number;
  time: number;
  date: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
  extraLength: number;
};

type CentralHeaderInput = HeaderInput & {
  externalAttrs: number;
  localHeaderOffset: number;
};

type EndInput = {
  entries: number;
  centralSize: number;
  centralOffset: number;
};

function buildLocalHeader(input: HeaderInput): Uint8Array {
  const buf = new Uint8Array(30);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, input.flags, true);
  view.setUint16(8, 8, true);
  view.setUint16(10, input.time, true);
  view.setUint16(12, input.date, true);
  view.setUint32(14, input.crc, true);
  view.setUint32(18, input.compressedSize, true);
  view.setUint32(22, input.uncompressedSize, true);
  view.setUint16(26, input.nameLength, true);
  view.setUint16(28, input.extraLength, true);
  return buf;
}

function buildCentralHeader(input: CentralHeaderInput): Uint8Array {
  const buf = new Uint8Array(46);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, input.flags, true);
  view.setUint16(10, 8, true);
  view.setUint16(12, input.time, true);
  view.setUint16(14, input.date, true);
  view.setUint32(16, input.crc, true);
  view.setUint32(20, input.compressedSize, true);
  view.setUint32(24, input.uncompressedSize, true);
  view.setUint16(28, input.nameLength, true);
  view.setUint16(30, input.extraLength, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, input.externalAttrs, true);
  view.setUint32(42, input.localHeaderOffset, true);
  return buf;
}

function buildEndOfCentralDirectory(input: EndInput): Uint8Array {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, input.entries, true);
  view.setUint16(10, input.entries, true);
  view.setUint32(12, input.centralSize, true);
  view.setUint32(16, input.centralOffset, true);
  view.setUint16(20, 0, true);
  return buf;
}

function buildExtendedTimestampExtra(modTime: Date): Uint8Array {
  const dataLength = 1 + 4;
  const buf = new Uint8Array(4 + dataLength);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0x5455, true);
  view.setUint16(2, dataLength, true);
  view.setUint8(4, 0x01);
  view.setUint32(5, Math.floor(modTime.getTime() / 1000) >>> 0, true);
  return buf;
}

function buildDataDescriptor(crc: number, compressedSize: number, uncompressedSize: number): Uint8Array {
  const buf = new Uint8Array(16);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc >>> 0, true);
  view.setUint32(8, compressedSize >>> 0, true);
  view.setUint32(12, uncompressedSize >>> 0, true);
  return buf;
}

function toDosDateTime(date: Date): { date: number; time: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  const dosTime = (hours << 11) | (minutes << 5) | seconds;

  return { date: dosDate & 0xffff, time: dosTime & 0xffff };
}

function normalizeRelPath(value: string): string {
  if (value === "." || value === "") {
    return "";
  }
  const normalized = value.split("\\").join("/");
  return posix.normalize(normalized).replace(/^\.\//, "");
}

function shouldSkip(name: string, skipPaths: string[]): boolean {
  if (!name) {
    return true;
  }

  const cleanedName = normalizeRelPath(name);

  for (const ignore of skipPaths) {
    const cleanedIgnore = normalizeRelPath(ignore);
    if (!cleanedIgnore) {
      continue;
    }
    if (cleanedName === cleanedIgnore) {
      return true;
    }
    if (cleanedName.startsWith(`${cleanedIgnore}/`)) {
      return true;
    }
  }

  return false;
}

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 1) !== 0) {
        crc = 0xedb88320 ^ (crc >>> 1);
      } else {
        crc = crc >>> 1;
      }
    }
    table[i] = crc >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    const index = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ crcTable[index]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

class ChunkWriter {
  #chunks: Uint8Array[] = [];
  length = 0;

  push(data: Uint8Array): void {
    this.#chunks.push(data);
    this.length += data.length;
  }

  concat(): Uint8Array {
    if (this.#chunks.length === 0) {
      return new Uint8Array();
    }
    if (this.#chunks.length === 1) {
      return this.#chunks[0] ?? new Uint8Array();
    }
    const merged = new Uint8Array(this.length);
    let offset = 0;
    for (const chunk of this.#chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }
}
