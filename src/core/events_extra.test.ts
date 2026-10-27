// PocketBun-only: verifies Go's embedded event data is retained by TS error-event wrappers.
import { expect, it } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { ModelEvent, ModelErrorEvent, RecordEvent, RecordErrorEvent, CollectionEvent, CollectionErrorEvent } from "./events.ts";

it("error events retain the source event extra map", async () => {
  const { app, cleanup } = await newTestApp();
  try {
    const model = new ModelEvent(app, null, "create");
    const record = new RecordEvent(app, null, "create");
    const collection = new CollectionEvent(app, null, "create");
    for (const event of [model, record, collection]) event.extra = { trace: "request" };
    const error = new Error("failed");
    const pairs = [
      [model, new ModelErrorEvent(model, error)],
      [record, new RecordErrorEvent(record, error)],
      [collection, new CollectionErrorEvent(collection, error)],
    ];
    for (const [source, wrapped] of pairs) {
      expect(wrapped!.extra).toBe(source!.extra);
      wrapped!.extra!.trace = "handled";
      expect(source!.extra!.trace).toBe("handled");
      wrapped!.extra = { replaced: true };
      expect(source!.extra!.trace).toBe("handled");
    }
  } finally {
    await cleanup();
  }
});
