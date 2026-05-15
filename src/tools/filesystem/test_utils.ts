// PocketBun-only: shared filesystem test helpers for creating fixture data.

import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64",
);

const tinyJpeg = Buffer.from(
  "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z",
  "base64",
);

const webpBytes = new Uint8Array([
  82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32, 24, 0, 0, 0, 48, 1, 0, 157, 1, 42, 1, 0, 1, 0, 2, 0, 52, 37, 164,
  0, 3, 112, 0, 254, 251, 253, 80, 0,
]);

async function writeAttrs(path: string, contentType: string) {
  const attrs = {
    "user.cache_control": "",
    "user.content_disposition": "",
    "user.content_encoding": "",
    "user.content_language": "",
    "user.content_type": contentType,
    "user.metadata": null,
  };
  await writeFile(`${path}.attrs`, JSON.stringify(attrs));
}

export async function createTestDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "pb_test"));

  await mkdir(join(dir, "empty"), { recursive: true });
  await mkdir(join(dir, "test"), { recursive: true });

  await writeFile(join(dir, "test/sub1.txt"), "sub1");
  await writeFile(join(dir, "test/sub2.txt"), "sub2");

  await writeFile(join(dir, "image.png"), tinyPng);
  await writeAttrs(join(dir, "image.png"), "image/png");

  await writeFile(join(dir, "image.jpg"), tinyJpeg);
  await writeAttrs(join(dir, "image.jpg"), "image/jpeg");

  await writeFile(join(dir, "image.svg"), "");

  await writeFile(join(dir, "image.webp"), webpBytes);

  await writeFile(join(dir, "image_!@ special"), tinyPng);

  await writeFile(join(dir, "image_noext"), tinyJpeg);
  await writeAttrs(join(dir, "image_noext"), "image/jpeg");

  await writeFile(join(dir, "style.css"), "");
  await writeFile(join(dir, "main.js"), "");
  await writeFile(join(dir, "main.mjs"), "");
  await writeFile(join(dir, "dummy.xlsx"), "");
  await writeFile(join(dir, "dummy.docx"), "");
  await writeFile(join(dir, "dummy.pptx"), "");

  return dir;
}
