import type { JsonValue } from "../domain/entities/generic/Json.js";

export function encodeJsonPointer(path: readonly string[]): string {
  return path.map((segment) => `/${segment.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");
}

export function decodeJsonPointer(pointer: string): string[] | undefined {
  if (pointer === "") {
    return [];
  }

  if (!pointer.startsWith("/")) {
    return undefined;
  }

  const decoded: string[] = [];
  for (const segment of pointer.slice(1).split("/")) {
    let decodedSegment = "";
    for (let index = 0; index < segment.length; index += 1) {
      const character = segment[index] ?? "";
      if (character !== "~") {
        decodedSegment += character;
        continue;
      }

      const escape = segment[index + 1] ?? "";
      if (escape !== "0" && escape !== "1") {
        return undefined;
      }

      decodedSegment += escape === "0" ? "~" : "/";
      index += 1;
    }
    decoded.push(decodedSegment);
  }

  return decoded;
}

export function getJsonValueAtPath(
  value: JsonValue,
  path: readonly string[],
): JsonValue | undefined {
  let current: JsonValue = value;

  for (const segment of path) {
    if (isJsonObject(current) && Object.hasOwn(current, segment)) {
      current = current[segment] as JsonValue;
      continue;
    }

    if (Array.isArray(current) && isArrayIndex(segment) && Number(segment) < current.length) {
      current = current[Number(segment)] as JsonValue;
      continue;
    }

    return undefined;
  }

  return current;
}

function isArrayIndex(value: string): boolean {
  return value === "0" || /^[1-9]\d*$/.test(value);
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
