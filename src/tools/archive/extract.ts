// Ported from pocketbase/tools/archive/extract.go

import { createReadStream, createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, open, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { createInflateRaw, inflateRawSync } from "node:zlib";

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
  await using input = await open(src, "r");
  const info = await stat(src);
  const tailSize = Math.min(info.size, 22 + 0xffff + 20);
  const tail = await readAt(input, tailSize, info.size - tailSize);
  const eocdOffset = findEndOfCentralDirectory(tail);
  if (eocdOffset < 0) {
    throw new Error("invalid zip: missing end of central directory");
  }
  const eocdView = new DataView(tail.buffer, tail.byteOffset + eocdOffset, 22);
  let totalEntries = eocdView.getUint16(10, true);
  let centralSize = eocdView.getUint32(12, true);
  let centralOffset = eocdView.getUint32(16, true);
  if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    const locatorOffset = eocdOffset - 20;
    if (locatorOffset < 0) throw new Error("invalid zip: missing ZIP64 locator");
    const locator = new DataView(tail.buffer, tail.byteOffset + locatorOffset, 20);
    if (locator.getUint32(0, true) !== 0x07064b50) throw new Error("invalid zip: bad ZIP64 locator");
    const zip64 = await readAt(input, 56, Number(locator.getBigUint64(8, true)));
    const zip64View = new DataView(zip64.buffer, zip64.byteOffset, zip64.byteLength);
    if (zip64View.getUint32(0, true) !== 0x06064b50) throw new Error("invalid zip: bad ZIP64 end record");
    totalEntries = Number(zip64View.getBigUint64(32, true));
    centralSize = Number(zip64View.getBigUint64(40, true));
    centralOffset = Number(zip64View.getBigUint64(48, true));
  }

  // normalize dest path to check later for Zip Slip
  const destRoot = normalizeDest(dest);
  const ensuredDirs = new Set<string>();
  const ensureDir = async (path: string): Promise<void> => {
    if (ensuredDirs.has(path)) {
      return;
    }
    await mkdir(path, { recursive: true });
    ensuredDirs.add(path);
  };

  let offset = centralOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    const entry = await readCentralDirectoryEntryAsync(input, offset);
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
      await ensureDir(targetPath);
      continue;
    }

    if (!isRegular || isSymlink) {
      continue;
    }

    await ensureDir(dirname(targetPath));
    const local = await readAt(input, 30, entry.localHeaderOffset);
    const localView = new DataView(local.buffer, local.byteOffset, local.byteLength);
    if (localView.getUint32(0, true) !== 0x04034b50) throw new Error("invalid zip: bad local file header signature");
    const dataStart = entry.localHeaderOffset + 30 + localView.getUint16(26, true) + localView.getUint16(28, true);
    const source = createReadStream(src, { start: dataStart, end: dataStart + entry.compressedSize - 1 });
    if (entry.compression === 0) await pipeline(source, createWriteStream(targetPath));
    else if (entry.compression === 8) await pipeline(source, createInflateRaw(), createWriteStream(targetPath));
    else throw new Error(`unsupported compression method: ${entry.compression}`);
  }

  if (centralOffset + centralSize > info.size) {
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

async function readAt(handle: Awaited<ReturnType<typeof open>>, size: number, position: number): Promise<Uint8Array> {
  const data = new Uint8Array(size);
  let offset = 0;
  while (offset < size) {
    const result = await handle.read(data, offset, size - offset, position + offset);
    if (result.bytesRead === 0) throw new Error("invalid zip: unexpected end of file");
    offset += result.bytesRead;
  }
  return data;
}

async function readCentralDirectoryEntryAsync(handle: Awaited<ReturnType<typeof open>>, offset: number): Promise<CentralEntry> {
  const header = await readAt(handle, 46, offset);
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== 0x02014b50) throw new Error("invalid zip: bad central directory signature");
  const nameLength = view.getUint16(28, true);
  const extraLength = view.getUint16(30, true);
  const commentLength = view.getUint16(32, true);
  const tail = await readAt(handle, nameLength + extraLength + commentLength, offset + 46);
  let compressedSize = view.getUint32(20, true);
  let uncompressedSize = view.getUint32(24, true);
  let localHeaderOffset = view.getUint32(42, true);
  if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
    let extraOffset = nameLength;
    const extraEnd = nameLength + extraLength;
    while (extraOffset + 4 <= extraEnd) {
      const extraView = new DataView(tail.buffer, tail.byteOffset + extraOffset, extraEnd - extraOffset);
      const id = extraView.getUint16(0, true);
      const size = extraView.getUint16(2, true);
      if (extraOffset + 4 + size > extraEnd) throw new Error("invalid zip: malformed extra field");
      if (id === 0x0001) {
        let valueOffset = 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = Number(extraView.getBigUint64(valueOffset, true));
          valueOffset += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = Number(extraView.getBigUint64(valueOffset, true));
          valueOffset += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = Number(extraView.getBigUint64(valueOffset, true));
        break;
      }
      extraOffset += 4 + size;
    }
  }
  return {
    name: new TextDecoder().decode(tail.slice(0, nameLength)),
    compressedSize,
    uncompressedSize,
    compression: view.getUint16(10, true),
    localHeaderOffset,
    mode: (view.getUint32(38, true) >>> 16) & 0xffff,
    nextOffset: offset + 46 + nameLength + extraLength + commentLength,
  };
}

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
