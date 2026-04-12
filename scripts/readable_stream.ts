// PocketBun-only: narrows Bun's ReadableStream runtime helpers for script tooling.
//
// Why this file exists:
// Bun exposes ReadableStream.text() at runtime, but the script-facing TypeScript
// surface doesn't declare it yet, so maintainers would otherwise need repeated
// casts or Response(...) wrappers in Bun-native tooling.

type TextReadableStream = ReadableStream<Uint8Array> & {
  text(): Promise<string>;
};

export async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await (stream as TextReadableStream).text();
}
