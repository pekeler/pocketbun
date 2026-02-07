// Ported from pocketbase/tools/archive/extract.go

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";

// Extract extracts the zip archive at "src" to "dest".
//
// Note that only dirs and regular files will be extracted.
// Symbolic links, named pipes, sockets, or any other irregular files
// are skipped because they come with too many edge cases and ambiguities.
export function Extract(src: string, dest: string): void {
  const data = readFileSync(src);

  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) {
    throw new Error("invalid zip: missing end of central directory");
  }

  const eocdView = new DataView(data.buffer, data.byteOffset + eocdOffset, 22);
  const totalEntries = eocdView.getUint16(10, true);
  const centralSize = eocdView.getUint32(12, true);
  const centralOffset = eocdView.getUint32(16, true);

  // normalize dest path to check later for Zip Slip
  const destRoot = normalizeDest(dest);

  let offset = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    const entry = readCentralDirectoryEntry(data, offset);
    offset = entry.nextOffset;

    const targetPath = resolve(destRoot, entry.name);
    if (!targetPath.startsWith(destRoot)) {
      throw new Error(`invalid file path: ${targetPath}`);
    }

    const mode = entry.mode;
    const isDir = entry.name.endsWith("/") || (mode & 0o040000) === 0o040000;
    const isSymlink = (mode & 0o120000) === 0o120000;
    const isRegular = mode === 0 || (mode & 0o100000) === 0o100000;

    if (isDir) {
      mkdirSync(targetPath, { recursive: true });
      continue;
    }

    if (!isRegular || isSymlink) {
      continue;
    }

    const fileData = extractFileData(data, entry);

    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, fileData);
  }

  if (centralOffset + centralSize > data.length) {
    throw new Error("invalid zip: central directory extends beyond file size");
  }
}

// ExtractAsync is PocketBun-only async alternative to Extract.
//
// It preserves the same behavior while avoiding synchronous filesystem I/O.
export async function ExtractAsync(src: string, dest: string): Promise<void> {
  const data = await readFile(src);

  const eocdOffset = findEndOfCentralDirectory(data);
  if (eocdOffset < 0) {
    throw new Error("invalid zip: missing end of central directory");
  }

  const eocdView = new DataView(data.buffer, data.byteOffset + eocdOffset, 22);
  const totalEntries = eocdView.getUint16(10, true);
  const centralSize = eocdView.getUint32(12, true);
  const centralOffset = eocdView.getUint32(16, true);

  // normalize dest path to check later for Zip Slip
  const destRoot = normalizeDest(dest);

  let offset = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    const entry = readCentralDirectoryEntry(data, offset);
    offset = entry.nextOffset;

    const targetPath = resolve(destRoot, entry.name);
    if (!targetPath.startsWith(destRoot)) {
      throw new Error(`invalid file path: ${targetPath}`);
    }

    const mode = entry.mode;
    const isDir = entry.name.endsWith("/") || (mode & 0o040000) === 0o040000;
    const isSymlink = (mode & 0o120000) === 0o120000;
    const isRegular = mode === 0 || (mode & 0o100000) === 0o100000;

    if (isDir) {
      await mkdir(targetPath, { recursive: true });
      continue;
    }

    if (!isRegular || isSymlink) {
      continue;
    }

    const fileData = extractFileData(data, entry);

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, fileData);
  }

  if (centralOffset + centralSize > data.length) {
    throw new Error("invalid zip: central directory extends beyond file size");
  }
}

type CentralEntry = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compression: number;
  localHeaderOffset: number;
  mode: number;
  nextOffset: number;
};

function findEndOfCentralDirectory(data: Uint8Array): number {
  const maxComment = 0xffff;
  const minOffset = Math.max(0, data.length - (22 + maxComment));
  for (let i = data.length - 22; i >= minOffset; i -= 1) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      return i;
    }
  }
  return -1;
}

function readCentralDirectoryEntry(data: Uint8Array, offset: number): CentralEntry {
  const view = new DataView(data.buffer, data.byteOffset + offset);
  const signature = view.getUint32(0, true);
  if (signature !== 0x02014b50) {
    throw new Error("invalid zip: bad central directory signature");
  }

  const compression = view.getUint16(10, true);
  const compressedSize = view.getUint32(20, true);
  const uncompressedSize = view.getUint32(24, true);
  const nameLength = view.getUint16(28, true);
  const extraLength = view.getUint16(30, true);
  const commentLength = view.getUint16(32, true);
  const externalAttrs = view.getUint32(38, true);
  const localHeaderOffset = view.getUint32(42, true);

  const nameStart = offset + 46;
  const nameEnd = nameStart + nameLength;
  const name = new TextDecoder().decode(data.slice(nameStart, nameEnd));

  const mode = (externalAttrs >>> 16) & 0xffff;

  return {
    name,
    compressedSize,
    uncompressedSize,
    compression,
    localHeaderOffset,
    mode,
    nextOffset: nameEnd + extraLength + commentLength,
  };
}

function extractFileData(data: Uint8Array, entry: CentralEntry): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset + entry.localHeaderOffset);
  const signature = view.getUint32(0, true);
  if (signature !== 0x04034b50) {
    throw new Error("invalid zip: bad local file header signature");
  }

  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;

  const compressed = data.slice(dataStart, dataEnd);
  if (entry.compression === 0) {
    return compressed;
  }
  if (entry.compression === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`unsupported compression method: ${entry.compression}`);
}

function normalizeDest(dest: string): string {
  const resolved = resolve(dest);
  return resolved.endsWith(sep) ? resolved : resolved + sep;
}
