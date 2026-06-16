import { describe, expect, expectTypeOf, it } from "vitest";

import { Either } from "../../src/domain/entities/generic/Either.js";

describe("Either", () => {
  it("maps successful values", () => {
    const result = Either.success<string, number>(2)
      .map((value) => value + 1)
      .match({
        success: (value) => value,
        error: () => 0,
      });

    expect(result).toBe(3);
  });

  it("preserves the error branch when flatMapping a failed value", () => {
    const result = Either.error<string>("invalid").flatMap((value: number) =>
      Either.success<string, string>(value.toString()),
    );

    expectTypeOf(result).toEqualTypeOf<Either<string, string>>();
    expect(result.value).toEqual({ type: "error", error: "invalid" });
  });

  it("maps errors", () => {
    const result = Either.error<string>("invalid").mapError((error) => ({
      message: error,
    }));

    expectTypeOf(result).toEqualTypeOf<Either<{ message: string }, never>>();
    expect(result.value).toEqual({ type: "error", error: { message: "invalid" } });
  });

  it("preserves the success branch when flatMapping an error from a successful value", () => {
    const result = Either.success<string, number>(2).flatMapError((error) =>
      Either.error<{ message: string }>({ message: error }),
    );

    expectTypeOf(result).toEqualTypeOf<Either<{ message: string }, number>>();
    expect(result.value).toEqual({ type: "success", data: 2 });
  });

  it("combines two successful values", () => {
    const result = Either.map2(
      [Either.success<string, number>(2), Either.success<string, number>(3)],
      (left, right) => left + right,
    );

    expect(result.value).toEqual({ type: "success", data: 5 });
  });
});
