// Ported from pocketbase/tools/router/unmarshal_request_data_test.go

import { describe, expect, it } from "bun:test";
import { JSONPayloadKey, unmarshalRequestData } from "./unmarshal_request_data.ts";

describe("unmarshalRequestData", () => {
  it("handles map data", () => {
    const data: Record<string, string[]> = {
      number1: ["1"],
      number2: ["2", "3"],
      number3: ["2.1", "-3.4"],
      number4: ["0", "-0", "0.0001"],
      string0: [""],
      string1: ["a"],
      string2: ["b", "c"],
      string3: [
        "0.0",
        "-0.0",
        "000.1",
        "000001",
        "-000001",
        "1.6E-35",
        "-1.6E-35",
        "10e100",
        "1_000_000",
        "1.000.000",
        " 123 ",
        "0b1",
        "0xFF",
        "1234A",
        "Infinity",
        "-Infinity",
        "undefined",
        "null",
      ],
      bool1: ["true"],
      bool2: ["true", "false"],
      mixed: ["true", "123", "test"],
      [JSONPayloadKey]: [`{"json_a":null,"json_b":123}`, `{"json_c":[1,2,3]}`],
    };

    const dest: Record<string, unknown> = {};
    const err = unmarshalRequestData(data, dest);
    expect(err).toBeNull();

    expect(dest).toEqual({
      number1: 1,
      number2: [2, 3],
      number3: [2.1, -3.4],
      number4: [0, "-0", 0.0001],
      string0: "",
      string1: "a",
      string2: ["b", "c"],
      string3: data.string3,
      bool1: true,
      bool2: [true, false],
      mixed: [true, 123, "test"],
      json_a: null,
      json_b: 123,
      json_c: [1, 2, 3],
    });
  });

  it("rejects invalid json payload", () => {
    const dest: Record<string, unknown> = {};
    const err = unmarshalRequestData({ [JSONPayloadKey]: ["[]"] }, dest);
    expect(err).toBeInstanceOf(Error);
  });
});
