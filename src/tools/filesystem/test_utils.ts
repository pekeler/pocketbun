// PocketBun-only: shared filesystem test helpers for creating fixture data.

import { mkdir, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X5l0cAAAAASUVORK5CYII=",
  "base64",
);

const tinyJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALCwwLCw0MDQ0NDhYREhYUFh8YGBcXGBkZIB0YHCAfHh8fIyAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJP/2wBDARERERgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGP/wAARCAAQABADASIAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAUGB//EABUBAQEAAAAAAAAAAAAAAAAAAAID/8QAFwEBAQEBAAAAAAAAAAAAAAAAAAIDBf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL8A/9k=",
  "base64",
);

const webpBytes = new Uint8Array([
  82, 73, 70, 70, 36, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 32,
  24, 0, 0, 0, 48, 1, 0, 157, 1, 42, 1, 0, 1, 0, 2, 0, 52, 37,
  164, 0, 3, 112, 0, 254, 251, 253, 80, 0,
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

  return dir;
}
