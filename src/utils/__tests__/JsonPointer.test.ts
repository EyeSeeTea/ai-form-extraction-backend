import { describe, expect, it } from "vitest";

import { decodeJsonPointer, encodeJsonPointer, getJsonValueAtPath } from "../JsonPointer.js";

describe("JSON Pointer utilities", () => {
  it("encodes and decodes RFC 6901 escape sequences", () => {
    const path = ["a/b", "tilde~key"];

    expect(encodeJsonPointer(path)).toBe("/a~1b/tilde~0key");
    expect(decodeJsonPointer("/a~1b/tilde~0key")).toEqual(path);
  });

  it("represents the document root with an empty pointer", () => {
    const value = { country: "Kenya" };

    expect(decodeJsonPointer("")).toEqual([]);
    expect(getJsonValueAtPath(value, [])).toEqual(value);
  });

  it("rejects malformed JSON Pointers", () => {
    expect(decodeJsonPointer("a/b")).toBeUndefined();
    expect(decodeJsonPointer("/bad~2escape")).toBeUndefined();
    expect(decodeJsonPointer("/trailing~")).toBeUndefined();
  });

  it("resolves object and array values by path", () => {
    const value = {
      "a/b": { items: [{ name: "Amina" }] },
    };

    expect(getJsonValueAtPath(value, ["a/b", "items", "0", "name"])).toBe("Amina");
    expect(getJsonValueAtPath(value, ["a/b", "items", "1", "name"])).toBeUndefined();
    expect(getJsonValueAtPath(value, ["a/b", "items", "01", "name"])).toBeUndefined();
  });
});
