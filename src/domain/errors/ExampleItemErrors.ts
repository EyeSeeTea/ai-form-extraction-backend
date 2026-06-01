import { Data } from "effect";

export class ExampleItemNotFoundError extends Data.TaggedError("ExampleItemNotFoundError")<{
  readonly id: string;
}> {}
