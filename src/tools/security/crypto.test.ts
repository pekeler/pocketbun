// Ported from pocketbase/tools/security/crypto_test.go

import { describe, it } from "bun:test";
import { Equal, HS256, HS512, MD5, SHA256, SHA512, S256Challenge } from "./crypto.ts";

describe("security crypto", () => {
  it("S256Challenge", () => {
    const scenarios = [
      { code: "", expected: "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU" },
      { code: "123", expected: "pmWkWSBCL51Bfkhn79xPuKBKHz__H6B-mY6G9_eieuM" },
    ];

    for (const scenario of scenarios) {
      const result = S256Challenge(scenario.code);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("MD5", () => {
    const scenarios = [
      { code: "", expected: "d41d8cd98f00b204e9800998ecf8427e" },
      { code: "123", expected: "202cb962ac59075b964b07152d234b70" },
    ];

    for (const scenario of scenarios) {
      const result = MD5(scenario.code);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("SHA256", () => {
    const scenarios = [
      { code: "", expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
      { code: "123", expected: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3" },
    ];

    for (const scenario of scenarios) {
      const result = SHA256(scenario.code);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("SHA512", () => {
    const scenarios = [
      {
        code: "",
        expected:
          "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
      },
      {
        code: "123",
        expected:
          "3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1eb8b85103e3be7ba613b31bb5c9c36214dc9f14a42fd7a2fdb84856bca5c44c2",
      },
    ];

    for (const scenario of scenarios) {
      const result = SHA512(scenario.code);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("HS256", () => {
    const scenarios = [
      {
        text: " ",
        secret: "test",
        expected: "9fb4e4a12d50728683a222b4fc466a69ee977332cfcdd6b9ebb44c7121dbd99f",
      },
      {
        text: " ",
        secret: "test2",
        expected: "d792417a504716e22805d940125ec12e68e8cb18fc84674703bd96c59f1e1228",
      },
      {
        text: "hello",
        secret: "test",
        expected: "f151ea24bda91a18e89b8bb5793ef324b2a02133cce15a28a719acbd2e58a986",
      },
      {
        text: "hello",
        secret: "test2",
        expected: "16436e8dcbf3d7b5b0455573b27e6372699beb5bfe94e6a2a371b14b4ae068f4",
      },
    ];

    for (const scenario of scenarios) {
      const result = HS256(scenario.text, scenario.secret);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("HS512", () => {
    const scenarios = [
      {
        text: " ",
        secret: "test",
        expected:
          "eb3bdb0352c95c38880c1f645fc7e1d1332644f938f50de0d73876e42d6f302e599bb526531ba79940e8b314369aaef3675322d8d851f9fc6ea9ed121286d196",
      },
      {
        text: " ",
        secret: "test2",
        expected:
          "8b69e84e9252af78ae8b1c4bed3c9f737f69a3df33064cfbefe76b36d19d1827285e543cdf066cdc8bd556cc0cd0e212d52e9c12a50cd16046181ff127f4cf7f",
      },
      {
        text: "hello",
        secret: "test",
        expected:
          "44f280e11103e295c26cd61dd1cdd8178b531b860466867c13b1c37a26b6389f8af110efbe0bb0717b9d9c87f6fe1c97b3b1690936578890e5669abf279fe7fd",
      },
      {
        text: "hello",
        secret: "test2",
        expected:
          "d7f10b1b66941b20817689b973ca9dfc971090e28cfb8becbddd6824569b323eca6a0cdf2c387aa41e15040007dca5a011dd4e4bb61cfd5011aa7354d866f6ef",
      },
    ];

    for (const scenario of scenarios) {
      const result = HS512(scenario.text, scenario.secret);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });

  it("Equal", () => {
    const scenarios = [
      { hash1: "", hash2: "", expected: true },
      { hash1: "abc", hash2: "abd", expected: false },
      { hash1: "abc", hash2: "abc", expected: true },
    ];

    for (const scenario of scenarios) {
      const result = Equal(scenario.hash1, scenario.hash2);
      if (result !== scenario.expected) {
        throw new Error(`Expected ${scenario.expected}, got ${result}`);
      }
    }
  });
});
