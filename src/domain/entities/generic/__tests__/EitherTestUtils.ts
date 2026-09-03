import type { Either } from "../Either.js";

export function getEitherSuccess<ErrorType extends Error, Data>(
  result: Either<ErrorType, Data>,
): Data {
  return result.match({
    success: (data) => data,
    error: (error) => {
      throw error;
    },
  });
}
