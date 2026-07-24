import type { JsonObject, JsonValue } from "../../src/domain/entities/generic/Json.js";

export type EvaluationMismatch = Readonly<{
  path: string;
  expected?: JsonValue | undefined;
  actual?: JsonValue | undefined;
  expectedPresent: boolean;
  actualPresent: boolean;
  confidence?: number;
}>;

export type EvaluationComparison = Readonly<{
  matched: number;
  mismatched: number;
  compared: number;
  mismatchPercentage: number | null;
}>;

export type EvaluationComparisonResult = Readonly<{
  mismatches: readonly EvaluationMismatch[];
  stats: EvaluationComparison;
}>;

type MismatchSide = Readonly<{ present: boolean; value: JsonValue | undefined }>;
type MutableComparison = { matched: number; mismatched: number };

export function compareEvaluationResults(
  expected: JsonValue,
  actual: JsonValue,
  confidence: Readonly<Record<string, number>> = {},
): EvaluationComparisonResult {
  const mismatches: EvaluationMismatch[] = [];
  const counts: MutableComparison = { matched: 0, mismatched: 0 };
  compareAt(
    { present: true, value: expected },
    { present: true, value: actual },
    "",
    confidence,
    mismatches,
    counts,
  );
  return { mismatches, stats: finalizeComparison(counts) };
}

export function summarizeEvaluationComparisons(
  comparisons: readonly EvaluationComparison[],
): EvaluationComparison {
  const counts: MutableComparison = { matched: 0, mismatched: 0 };
  for (const comparison of comparisons) {
    counts.matched += comparison.matched;
    counts.mismatched += comparison.mismatched;
  }
  return finalizeComparison(counts);
}

function compareAt(
  expected: MismatchSide,
  actual: MismatchSide,
  path: string,
  confidence: Readonly<Record<string, number>>,
  mismatches: EvaluationMismatch[],
  counts: MutableComparison,
): void {
  if (
    expected.present &&
    actual.present &&
    expected.value !== undefined &&
    actual.value !== undefined &&
    deepEqualValue(expected.value, actual.value)
  ) {
    counts.matched += countComparableLeaves(expected.value);
    return;
  }

  if (
    expected.present &&
    actual.present &&
    isJsonObjectValue(expected.value) &&
    isJsonObjectValue(actual.value)
  ) {
    const keys = new Set([...Object.keys(expected.value), ...Object.keys(actual.value)]);
    for (const key of keys) {
      compareAt(
        { present: Object.hasOwn(expected.value, key), value: expected.value[key] },
        { present: Object.hasOwn(actual.value, key), value: actual.value[key] },
        `${path}/${encodeJsonPointerPart(key)}`,
        confidence,
        mismatches,
        counts,
      );
    }
    return;
  }

  if (
    expected.present &&
    actual.present &&
    Array.isArray(expected.value) &&
    Array.isArray(actual.value)
  ) {
    const length = Math.max(expected.value.length, actual.value.length);
    for (let index = 0; index < length; index += 1) {
      compareAt(
        { present: index < expected.value.length, value: expected.value[index] },
        { present: index < actual.value.length, value: actual.value[index] },
        `${path}/${String(index)}`,
        confidence,
        mismatches,
        counts,
      );
    }
    return;
  }

  if (expected.present && actual.present) {
    recordMismatch(mismatches, counts, {
      path,
      expected: expected.value,
      actual: actual.value,
      expectedPresent: true,
      actualPresent: true,
      ...(confidence[path] === undefined ? {} : { confidence: confidence[path] }),
    });
    return;
  }

  if (expected.present && isContainer(expected.value)) {
    collectPresentLeaves(expected.value, path, "expected", confidence, mismatches, counts);
    return;
  }
  if (actual.present && isContainer(actual.value)) {
    collectPresentLeaves(actual.value, path, "actual", confidence, mismatches, counts);
    return;
  }

  recordMismatch(mismatches, counts, {
    path,
    ...(expected.present ? { expected: expected.value } : {}),
    ...(actual.present ? { actual: actual.value } : {}),
    expectedPresent: expected.present,
    actualPresent: actual.present,
    ...(confidence[path] === undefined ? {} : { confidence: confidence[path] }),
  });
}

function collectPresentLeaves(
  value: JsonValue,
  path: string,
  side: "expected" | "actual",
  confidence: Readonly<Record<string, number>>,
  mismatches: EvaluationMismatch[],
  counts: MutableComparison,
): void {
  if (isJsonObjectValue(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      addContainerMismatch(path, side, value, confidence, mismatches, counts);
      return;
    }
    for (const key of keys) {
      const child = value[key];
      if (child !== undefined) {
        collectPresentLeaves(
          child,
          `${path}/${encodeJsonPointerPart(key)}`,
          side,
          confidence,
          mismatches,
          counts,
        );
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      addContainerMismatch(path, side, value, confidence, mismatches, counts);
      return;
    }
    value.forEach((child, index) => {
      collectPresentLeaves(child, `${path}/${String(index)}`, side, confidence, mismatches, counts);
    });
    return;
  }
  recordMismatch(mismatches, counts, {
    path,
    ...(side === "expected" ? { expected: value } : { actual: value }),
    expectedPresent: side === "expected",
    actualPresent: side === "actual",
    ...(confidence[path] === undefined ? {} : { confidence: confidence[path] }),
  });
}

function addContainerMismatch(
  path: string,
  side: "expected" | "actual",
  value: JsonValue,
  confidence: Readonly<Record<string, number>>,
  mismatches: EvaluationMismatch[],
  counts: MutableComparison,
): void {
  recordMismatch(mismatches, counts, {
    path,
    ...(side === "expected" ? { expected: value } : { actual: value }),
    expectedPresent: side === "expected",
    actualPresent: side === "actual",
    ...(confidence[path] === undefined ? {} : { confidence: confidence[path] }),
  });
}

function recordMismatch(
  mismatches: EvaluationMismatch[],
  counts: MutableComparison,
  mismatch: EvaluationMismatch,
): void {
  mismatches.push(mismatch);
  counts.mismatched += 1;
}

function countComparableLeaves(value: JsonValue): number {
  if (Array.isArray(value)) {
    let count = 0;
    for (const child of value) count += countComparableLeaves(child);
    return count;
  }
  if (isJsonObjectValue(value)) {
    let count = 0;
    for (const child of Object.values(value)) count += countComparableLeaves(child);
    return count;
  }
  return 1;
}

function finalizeComparison(counts: MutableComparison): EvaluationComparison {
  const compared = counts.matched + counts.mismatched;
  return {
    ...counts,
    compared,
    mismatchPercentage: compared === 0 ? null : (counts.mismatched / compared) * 100,
  };
}

function isJsonObjectValue(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContainer(value: JsonValue | undefined): value is JsonObject | JsonValue[] {
  return isJsonObjectValue(value) || Array.isArray(value);
}

function encodeJsonPointerPart(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function deepEqual(left: JsonObject, right: JsonObject): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    return deepEqualValue(left[key], right[key]);
  });
}

function deepEqualValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepEqualValue(value, right[index]))
    );
  }
  if (typeof left === "object" && left !== null && typeof right === "object" && right !== null) {
    return deepEqual(left as JsonObject, right as JsonObject);
  }
  return false;
}
