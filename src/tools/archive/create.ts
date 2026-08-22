// Ported from pocketbase/tools/archive/create.go

import { createReadStream, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { lstat, mkdir, open, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, posix, relative } from "node:path";
import { createDeflateRaw, deflateRawSync } from "node:zlib";

const textEncoder = new TextEncoder();
const uint16Max = 0xffff;
const uint32Max = 0xffffffff;

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
  return CreateAsyncWithFileOverrides(src, dest, new Map(), ...skipPaths);
}

// CreateAsyncWithFileOverrides is a PocketBun-only backup helper that replaces
// selected archive entries with files containing an already-created snapshot.
export async function CreateAsyncWithFileOverrides(
  src: string,
  dest: string,
  overrides: ReadonlyMap<string, string>,
  ...skipPaths: string[]
): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });

  try {
    const files = await collectFilesAsync(src, skipPaths, overrides);
    await buildZipAsync(files, dest);
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

type AsyncZipEntry = {
  name: string;
  source: string;
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

async function collectFilesAsync(
  src: string,
  skipPaths: string[],
  overrides: ReadonlyMap<string, string> = new Map(),
): Promise<AsyncZipEntry[]> {
  const entries: AsyncZipEntry[] = [];
  const unusedOverrides = new Set(overrides.keys());

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

      const info = await lstat(fullPath);
      const source = overrides.get(rel) ?? fullPath;
      unusedOverrides.delete(rel);

      entries.push({
        name: rel,
        source,
        modTime: info.mtime,
        mode: info.mode,
      });
    }
  };

  await walk(src);
  if (unusedOverrides.size > 0) {
    throw new Error(`archive override files not found: ${[...unusedOverrides].join(", ")}`);
  }
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

async function buildZipAsync(entries: AsyncZipEntry[], dest: string): Promise<void> {
  await using output = await open(dest, "w");
  const central = new ChunkWriter();
  let offset = 0;

  const write = async (data: Uint8Array): Promise<void> => {
    let written = 0;
    while (written < data.length) {
      const result = await output.write(data, written);
      written += result.bytesWritten;
    }
    offset += data.length;
  };

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const { date, time } = toDosDateTime(entry.modTime);
    const localHeaderOffset = offset;
    const sourceInfo = await stat(entry.source);
    // Reserve ZIP64 local-header fields before streaming when a source may exceed
    // classic ZIP's 32-bit size fields. Compression can grow a little, too.
    const useZip64 = sourceInfo.size >= uint32Max - 0x100000 || offset >= uint32Max;
    const extra = useZip64
      ? concatBytes(buildExtendedTimestampExtra(entry.modTime), buildZip64Extra(0, 0))
      : buildExtendedTimestampExtra(entry.modTime);
    const flags = 0x08;

    await write(
      buildLocalHeader({
        flags,
        time,
        date,
        crc: 0,
        compressedSize: 0,
        uncompressedSize: 0,
        nameLength: nameBytes.length,
        extraLength: extra.length,
        version: useZip64 ? 45 : 20,
      }),
    );
    await write(nameBytes);
    await write(extra);

    let crc = 0xffffffff;
    let uncompressedSize = 0;
    let compressedSize = 0;
    const input = createReadStream(entry.source);
    input.on("data", (chunk: Buffer) => {
      const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      crc = updateCrc32(crc, bytes);
      uncompressedSize += bytes.length;
    });
    const compressor = createDeflateRaw({ level: sourceInfo.size === 0 ? 0 : 1 });
    input.pipe(compressor);
    for await (const chunk of compressor) {
      const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      compressedSize += bytes.length;
      await write(bytes);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const entryUsesZip64 = useZip64 || compressedSize > uint32Max || uncompressedSize > uint32Max;
    await write(buildDataDescriptor(crc, compressedSize, uncompressedSize, entryUsesZip64));

    const centralExtra = entryUsesZip64
      ? concatBytes(
          buildExtendedTimestampExtra(entry.modTime),
          buildZip64Extra(uncompressedSize, compressedSize, localHeaderOffset >= uint32Max ? localHeaderOffset : undefined),
        )
      : buildExtendedTimestampExtra(entry.modTime);

    central.push(
      buildCentralHeader({
        flags,
        time,
        date,
        crc,
        compressedSize: entryUsesZip64 ? uint32Max : compressedSize,
        uncompressedSize: entryUsesZip64 ? uint32Max : uncompressedSize,
        nameLength: nameBytes.length,
        extraLength: centralExtra.length,
        externalAttrs: (entry.mode & 0xffff) << 16,
        localHeaderOffset: localHeaderOffset >= uint32Max ? uint32Max : localHeaderOffset,
        version: entryUsesZip64 ? 45 : 20,
      }),
    );
    central.push(nameBytes);
    central.push(centralExtra);
  }

  const centralOffset = offset;
  const centralBytes = central.concat();
  await write(centralBytes);
  const archiveUsesZip64 = entries.length >= uint16Max || centralBytes.length >= uint32Max || centralOffset >= uint32Max;
  if (archiveUsesZip64) {
    const zip64EndOffset = offset;
    await write(buildZip64EndOfCentralDirectory(entries.length, centralBytes.length, centralOffset));
    await write(buildZip64EndOfCentralDirectoryLocator(zip64EndOffset));
  }
  await write(
    buildEndOfCentralDirectory({
      entries: archiveUsesZip64 ? uint16Max : entries.length,
      centralSize: archiveUsesZip64 ? uint32Max : centralBytes.length,
      centralOffset: archiveUsesZip64 ? uint32Max : centralOffset,
    }),
  );
}

type HeaderInput = {
  version?: number;
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
  version?: number;
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
  view.setUint16(4, input.version ?? 20, true);
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
  view.setUint16(6, input.version ?? 20, true);
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

function buildDataDescriptor(crc: number, compressedSize: number, uncompressedSize: number, zip64 = false): Uint8Array {
  const buf = new Uint8Array(zip64 ? 24 : 16);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x08074b50, true);
  view.setUint32(4, crc >>> 0, true);
  if (zip64) {
    view.setBigUint64(8, BigInt(compressedSize), true);
    view.setBigUint64(16, BigInt(uncompressedSize), true);
  } else {
    view.setUint32(8, compressedSize >>> 0, true);
    view.setUint32(12, uncompressedSize >>> 0, true);
  }
  return buf;
}

function buildZip64Extra(uncompressedSize: number, compressedSize: number, localHeaderOffset?: number): Uint8Array {
  const values = localHeaderOffset === undefined ? 2 : 3;
  const buf = new Uint8Array(4 + values * 8);
  const view = new DataView(buf.buffer);
  view.setUint16(0, 0x0001, true);
  view.setUint16(2, values * 8, true);
  view.setBigUint64(4, BigInt(uncompressedSize), true);
  view.setBigUint64(12, BigInt(compressedSize), true);
  if (localHeaderOffset !== undefined) {
    view.setBigUint64(20, BigInt(localHeaderOffset), true);
  }
  return buf;
}

function buildZip64EndOfCentralDirectory(entries: number, centralSize: number, centralOffset: number): Uint8Array {
  const buf = new Uint8Array(56);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06064b50, true);
  view.setBigUint64(4, 44n, true);
  view.setUint16(12, 45, true);
  view.setUint16(14, 45, true);
  view.setUint32(16, 0, true);
  view.setUint32(20, 0, true);
  view.setBigUint64(24, BigInt(entries), true);
  view.setBigUint64(32, BigInt(entries), true);
  view.setBigUint64(40, BigInt(centralSize), true);
  view.setBigUint64(48, BigInt(centralOffset), true);
  return buf;
}

function buildZip64EndOfCentralDirectoryLocator(offset: number): Uint8Array {
  const buf = new Uint8Array(20);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x07064b50, true);
  view.setUint32(4, 0, true);
  view.setBigUint64(8, BigInt(offset), true);
  view.setUint32(16, 1, true);
  return buf;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
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

function crc32(data: Uint8Array): number {
  return Bun.hash.crc32(data);
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function updateCrc32(crc: number, data: Uint8Array): number {
  let value = crc;
  for (const byte of data) {
    value = crc32Table[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }
  return value >>> 0;
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
