// PocketBun-only: verifies startup banner hooks for Bun's sync and async server APIs.
import { describe, expect, it, spyOn } from "bun:test";
import { newTestApp } from "../tests/app.ts";
import { retryServerStart } from "../tests/helpers.ts";
import { serve, serveAsync } from "./serve.ts";

describe("serve startup banner", () => {
  for (const start of [serve, serveAsync]) {
    for (const mode of ["default", "custom", "suppressed", "hidden", "custom-when-hidden"] as const) {
      it.serial(`${start.name}: ${mode}`, async () => {
        const { app, cleanup } = await newTestApp();
        const output: string[] = [];
        const calls: string[] = [];
        using _log = spyOn(console, "log").mockImplementation((text) => output.push(String(text)));
        const showStartBanner = mode !== "hidden" && mode !== "custom-when-hidden";
        app.onServe().bindFunc((event) => {
          event.installerFunc = null;
          expect(typeof event.startBannerFunc).toBe(showStartBanner ? "function" : "object");
          expect(event.startBannerFunc).toBe(event.StartBannerFunc);
          if (mode === "custom" || mode === "custom-when-hidden") {
            event.startBannerFunc = (baseURL) => calls.push(baseURL);
          } else if (mode === "suppressed") {
            event.startBannerFunc = () => {};
          }
          return event.next();
        });
        try {
          const server = await retryServerStart(() => start(app, { httpAddr: "127.0.0.1:0", showStartBanner }));
          try {
            const baseURL = `http://${server.hostname}:${server.port}`;
            if (mode === "default") {
              expect(output).toHaveLength(3);
              expect(output[0]).toContain(`Server started at ${baseURL}`);
              expect(output.slice(1)).toEqual([`> Dashboard: ${baseURL}/_/`, `> REST API:  ${baseURL}/api/`]);
            } else {
              expect(output).toEqual([]);
            }
            expect(calls).toEqual(mode.startsWith("custom") ? [baseURL] : []);
          } finally {
            await server.stop();
          }
        } finally {
          await cleanup();
        }
      });
    }
  }
});
