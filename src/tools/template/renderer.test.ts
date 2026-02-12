// Ported from pocketbase/tools/template/renderer_test.go

import { describe, expect, it } from "bun:test";
import { buildRenderer, Renderer, SafeString } from "./renderer.ts";

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

  it("buildRenderer internal parser supports function calls, literals, and template includes", () => {
    const renderer = buildRenderer(
      [
        {
          name: "base",
          content:
            'Hello {{upper .Name}} {{template "suffix"}} {{template "withCtx" .Name}} {{.Name | append "!"}} {{"<b>"}} {{raw "<i>x</i>"}} {{define "suffix"}}SFX{{end}} {{define "withCtx"}}CTX={{.}}{{end}}',
        },
      ],
      {
        upper: (value: unknown) => String(value).toUpperCase(),
        append: (suffix: unknown, value: unknown) => `${String(value)}${String(suffix)}`,
        raw: (value: unknown) => new SafeString(String(value)),
      },
      { useExternalParser: false },
    );

    const result = renderer.Render({ Name: "Ada" });
    expect(result.trimEnd()).toBe("Hello ADA SFX CTX=Ada Ada! &lt;b&gt; <i>x</i>");
  });
});
