// Ported from pocketbase/tools/security/random_test.go

import { describe, it } from "bun:test";
import { pseudorandomString, pseudorandomStringWithAlphabet, randomString, randomStringWithAlphabet } from "./random.ts";

describe("security random", () => {
  it("RandomString", () => {
    testRandomString(randomString);
  });

  it("RandomStringWithAlphabet", () => {
    testRandomStringWithAlphabet(randomStringWithAlphabet);
  });

  it("PseudorandomString", () => {
    testRandomString(pseudorandomString);
  });

  it("PseudorandomStringWithAlphabet", () => {
    testRandomStringWithAlphabet(pseudorandomStringWithAlphabet);
  });
});

function testRandomStringWithAlphabet(randomFunc: (length: number, alphabet: string) => string): void {
  const scenarios = [
    { alphabet: "0123456789_", expectPattern: /[0-9_]+/ },
    { alphabet: "abcdef123", expectPattern: /[abcdef123]+/ },
    { alphabet: "!@#$%^&*()", expectPattern: /[!@#$%^&*()]+/ },
  ];

  for (const scenario of scenarios) {
    const generated: string[] = [];
    const length = 10;

    for (let i = 0; i < 500; i += 1) {
      const run = (attempt: number): void => {
        const result = randomFunc(length, scenario.alphabet);

        if (result.length !== length) {
          throw new Error(`(${i}) Expected the length of the string to be ${length}, got ${result.length}`);
        }

        if (!scenario.expectPattern.test(result)) {
          throw new Error(
            `(${i}) The generated string should have only ${scenario.expectPattern.source} characters, got ${result}`,
          );
        }

        if (generated.includes(result)) {
          if (attempt > 3) {
            throw new Error(`(${i}) Repeating random string - found ${result} in ${generated.join(", ")}`);
          }
          run(attempt + 1);
          return;
        }

        generated.push(result);
      };

      run(1);
    }
  }
}

function testRandomString(randomFunc: (length: number) => string): void {
  const generated: string[] = [];
  const pattern = /[a-zA-Z0-9]+/;
  const length = 10;

  for (let i = 0; i < 500; i += 1) {
    const run = (attempt: number): void => {
      const result = randomFunc(length);

      if (result.length !== length) {
        throw new Error(`(${i}) Expected the length of the string to be ${length}, got ${result.length}`);
      }

      if (!pattern.test(result)) {
        throw new Error(`(${i}) The generated string should have only [a-zA-Z0-9]+ characters, got ${result}`);
      }

      if (generated.includes(result)) {
        if (attempt > 3) {
          throw new Error(`(${i}) Repeating random string - found ${result} in ${generated.join(", ")}`);
        }
        run(attempt + 1);
        return;
      }

      generated.push(result);
    };

    run(1);
  }
}
