# Effect From Futures

Quick reference for developers used to EyeSeeTea `Future<E, D>` values.

The mental model is very similar: both Futures and Effects describe lazy
computations with typed errors. The main difference is that Effect is a larger
runtime and standard library around that idea.

## Type Shape

```ts
// Future
Future<E, D>;

// Effect
Effect.Effect<A, E, R>;
```

| Concept      | Future           | Effect                      |
| ------------ | ---------------- | --------------------------- |
| Success type | `D`              | `A`                         |
| Error type   | `E`              | `E`                         |
| Requirements | Manual injection | `R`, usually `never` here   |
| Run          | `.run(...)`      | `Effect.runPromise(effect)` |
| Promise      | `.toPromise()`   | `Effect.runPromise(effect)` |
| Cancel       | returned cancel  | fiber interruption          |

In this backend starter, use cases normally return:

```ts
Effect.Effect<Success, Error>;
```

The third type parameter is omitted because dependencies are injected through
constructors and resolved by `CompositionRoot`.

## Basic Mapping

| Future                                    | Effect                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `Future.success(value)`                   | `Effect.succeed(value)`                         |
| `Future.error(error)`                     | `Effect.fail(error)`                            |
| `future.map(fn)`                          | `effect.pipe(Effect.map(fn))`                   |
| `future.flatMap(fn)` / `future.chain(fn)` | `effect.pipe(Effect.flatMap(fn))`               |
| `future.mapError(fn)`                     | `effect.pipe(Effect.mapError(fn))`              |
| `future.flatMapError(fn)`                 | `effect.pipe(Effect.catchAll(fn))`              |
| `Future.void()`                           | `Effect.void`                                   |
| `Future.sleep(ms)`                        | `Effect.sleep(Duration.millis(ms))`             |
| `Future.joinObj(obj)`                     | `Effect.all(obj)`                               |
| `Future.parallel(items, { concurrency })` | `Effect.all(items, { concurrency })`            |
| `Future.sequential(items)`                | `Effect.all(items, { concurrency: 1 })`         |
| `Future.block(async $ => ...)`            | `Effect.gen(function* () { ... })`              |
| `Future.fromComputation(...)`             | `Effect.async(...)` or `Effect.tryPromise(...)` |

Import `Duration` from `effect` when using `Duration.millis(ms)`.

## Success And Failure

Future:

```ts
const user$ = Future.success(user);
const error$ = Future.error(new Error("No user"));
```

Effect:

```ts
const userEffect = Effect.succeed(user);
const errorEffect = Effect.fail(new Error("No user"));
```

Use `Effect.fail` for expected typed failures. Reserve `Effect.die` for defects:
bugs or impossible states that callers should not handle as normal errors.

## Mapping

Future:

```ts
return this.userRepository.getCurrent().map((user) => user.name);
```

Effect:

```ts
return this.userRepository.getCurrent.pipe(Effect.map((user) => user.name));
```

## Chaining

Future:

```ts
return getUser(id).flatMap((user) => getPermissions(user.id));
```

Effect:

```ts
return getUser(id).pipe(Effect.flatMap((user) => getPermissions(user.id)));
```

## Blocks

Future:

```ts
return Future.block(async ($) => {
  const user = await $(getUser(id));
  const permissions = await $(getPermissions(user.id));
  return { user, permissions };
});
```

Effect:

```ts
return Effect.gen(function* () {
  const user = yield* getUser(id);
  const permissions = yield* getPermissions(user.id);
  return { user, permissions };
});
```

Important differences:

- Use `yield*`, not `await`, inside `Effect.gen`.
- The generator is not `async`.
- A failed yielded effect short-circuits the whole computation.

When accessing class fields, use:

```ts
return Effect.gen(this, function* () {
  const user = yield* this.userRepository.getCurrent;
  return user;
});
```

## Error Handling

Future:

```ts
return getUser(id).flatMapError(() => Future.success(defaultUser));
```

Effect:

```ts
return getUser(id).pipe(Effect.catchAll(() => Effect.succeed(defaultUser)));
```

Prefer specific handlers when the error is tagged:

```ts
return getUser(id).pipe(Effect.catchTag("UserNotFoundError", () => Effect.succeed(defaultUser)));
```

For branching outside the Effect pipeline, convert to `Either` at the boundary:

```ts
const result = await Effect.runPromise(useCase.execute(id).pipe(Effect.either));

if (Either.isLeft(result)) {
  // result.left is the typed error
}
```

Use `Either.isLeft` / `Either.isRight`, not direct `_tag` checks.

## Pattern Matching

Futures code often uses `instanceof`, `errorCode`, or custom fields. With
Effect, domain errors should usually be `Data.TaggedError`, which makes matching
explicit:

```ts
return Match.value(error).pipe(
  Match.tag("ExampleItemNotFoundError", () => reply.code(404).send({ error: "Not Found" })),
  Match.orElse((unhandled) => {
    throw unhandled;
  }),
);
```

Use `Match.tagsExhaustive` when all cases are known and must be handled locally.

## Parallel And Sequential Composition

Future:

```ts
return Future.joinObj({
  user: getUser(id),
  permissions: getPermissions(id),
});
```

Effect:

```ts
return Effect.all({
  user: getUser(id),
  permissions: getPermissions(id),
});
```

With concurrency:

```ts
return Effect.all(items.map(processItem), { concurrency: 4 });
```

Sequential:

```ts
return Effect.all(items.map(processItem), { concurrency: 1 });
```

## Wrapping Promises And Callbacks

Future:

```ts
return Future.fromComputation((resolve, reject) => {
  api.getData().then(resolve).catch(reject);
  return api.cancel;
});
```

Effect for ordinary Promise APIs:

```ts
return Effect.tryPromise({
  try: () => api.getData(),
  catch: (cause) => new ApiError({ cause }),
});
```

Effect for callback or cancellable APIs:

```ts
return Effect.async<Data, ApiError>((resume, signal) => {
  api
    .getData()
    .then((data) => resume(Effect.succeed(data)))
    .catch((cause) => resume(Effect.fail(new ApiError({ cause }))));

  signal.addEventListener("abort", () => api.cancel());
});
```

Use `Effect.tryPromise` for simple Promise APIs. Use `Effect.async` when you need
to adapt callbacks or connect Effect interruption to a cancellation API.

## Running

Future:

```ts
const cancel = user$.run(onSuccess, onError);
```

Effect in route handlers:

```ts
const user = await Effect.runPromise(getUser(id));
```

Effect in tests:

```ts
const user = await Effect.runPromise(getUser(id));
const exit = await Effect.runPromiseExit(getUser(id));
```

Do not run effects inside repositories or use cases. Build the effect there and
run it at the boundary: HTTP route, CLI command, worker entry point, or test.

## Common Migration Rules

- `FutureData<D>` maps to `Effect.Effect<D, Error>` or a more specific tagged
  error type.
- `Future.success` maps to `Effect.succeed`.
- `Future.error` maps to `Effect.fail`.
- `Future.block` maps to `Effect.gen`.
- `Future.joinObj` / `Future.parallel` usually map to `Effect.all`.
- `flatMapError` maps to `Effect.catchAll` or `Effect.catchTag`.
- Keep errors specific and tagged in domain code.
- Keep HTTP mapping outside use cases.
- Prefer constructor injection in this starter, even though Effect also has
  `Context` / `Layer`.
