// Ported from pocketbase/tools/template/renderer_test.go

import { describe, it } from "bun:test";
import { Renderer } from "./renderer.ts";

describe("Renderer", () => {
  it("Render", () => {
    const scenarios = {
      "with nil template": {
        renderer: new Renderer(null, null),
        expectedHasErr: true,
        expectedResult: "",
      },
      "with parse error": {
        renderer: new Renderer({ render: () => "ok" }, new Error("test")),
        expectedHasErr: true,
        expectedResult: "",
      },
      "with execute error": {
        renderer: new Renderer({
          render: () => {
            throw new Error("test");
          },
        }),
        expectedHasErr: true,
        expectedResult: "",
      },
      "no error": {
        renderer: new Renderer({ render: () => "Hello world!" }),
        expectedHasErr: false,
        expectedResult: "Hello world!",
      },
    };

    for (const scenario of Object.values(scenarios)) {
      let result = "";
      let hasErr = false;

      try {
        result = scenario.renderer.Render({ Name: "world" });
      } catch {
        hasErr = true;
      }

      if (hasErr !== scenario.expectedHasErr) {
        throw new Error(`Expected hasErr ${scenario.expectedHasErr}, got ${hasErr}`);
      }

      if (result !== scenario.expectedResult) {
        throw new Error(`Expected result ${scenario.expectedResult}, got ${result}`);
      }
    }
  });
});
