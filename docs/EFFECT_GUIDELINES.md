# Effect Guidelines for Clean Architecture

This document defines the conventions for using the [Effect](https://effect.website/docs) library in this
project. It assumes familiarity with Clean Architecture boundaries and TypeScript.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [Effect Type Conventions](#effect-type-conventions)
3. [Domain Layer](#domain-layer)
4. [Data Layer](#data-layer)
5. [API Layer](#api-layer)
6. [Choosing the Right Effect Shape](#choosing-the-right-effect-shape)
7. [Pattern Matching](#pattern-matching)
8. [Composition Root](#composition-root)
9. [Dependency Injection Policy](#dependency-injection-policy)
10. [Error Handling Strategy](#error-handling-strategy)
11. [Testing with Effect](#testing-with-effect)
12. [Keep It Simple](#keep-it-simple)
13. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Core Principles

1. **Effect at the core, not at the edges.** The domain and data layers use
   `Effect` for typed errors and composable operations. The API layer runs effects
   at the boundary, converting results into HTTP responses.

2. **Typed errors over thrown exceptions.** Every expected failure is modeled as a
   tagged error in the `Effect` error channel. Unexpected failures (bugs, crashes)
   are defects — they are not caught by normal error handling.

3. **Constructor injection for dependencies.** Use cases receive repository
   instances through constructor injection. The `CompositionRoot` wires
   everything together. This keeps the domain free from Effect's DI system
   while still leveraging typed effects.

4. **No requirement leakage.** Use case `execute` methods return
   `Effect<A, E>` with the Requirements parameter set to `never`. Dependencies
   are fully resolved at construction time.

---

## Effect Type Conventions

The `Effect` type has three parameters:

```
Effect<Success, Error, Requirements>
```

| Parameter      | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| `Success`      | The value produced when the effect succeeds.                         |
| `Error`        | The typed error(s) that can occur — tracked as a union.              |
| `Requirements` | Services required from the context. Should be `never` for use cases. |

### Naming Conventions

- Domain errors: `<Entity><Reason>Error` — e.g., `ExampleItemNotFoundError`.
- Infrastructure errors: `DatabaseError`, `HttpClientError`, etc.
- Use cases: `<Verb><Entity>UseCase` — e.g., `CreateExampleItemUseCase`.

---

## Domain Layer

### Entities

Entities are **plain TypeScript types** — no Effect dependency:

```ts
export type ExampleItem = {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
};
```

### Domain Errors

Use `Data.TaggedError` for all expected errors. The `_tag` field acts as a
discriminant for pattern matching:

```ts
import { Data } from "effect";

export class ExampleItemNotFoundError extends Data.TaggedError("ExampleItemNotFoundError")<{
  readonly id: string;
}> {}
```

**Rules:**

- One file per error group (e.g., `ExampleItemErrors.ts`, `DatabaseError.ts`).
- Every tagged error must have a unique `_tag` string across the codebase.
- Include only the data needed to describe the failure (e.g., the missing `id`).
- Domain errors live in `src/domain/errors/`.

### Repository Interfaces

Repository methods return `Effect` instead of `Promise`. The error channel
declares what can go wrong:

```ts
import type { Effect, Option } from "effect";

export interface ExampleItemRepository {
  readonly list: Effect.Effect<ExampleItem[], DatabaseError>;
  readonly create: (
    input: Pick<ExampleItem, "id" | "name">,
  ) => Effect.Effect<ExampleItem, DatabaseError>;
  readonly update: (
    id: string,
    input: Pick<ExampleItem, "name">,
  ) => Effect.Effect<Option.Option<ExampleItem>, DatabaseError>;
}
```

**Rules:**

- Use `readonly` property syntax for parameter-less methods (`list`) and
  function syntax for parameterized methods (`create`, `update`).
- The error channel only contains infrastructure errors (`DatabaseError`).
  Domain-level error mapping happens in the use case.
- Model expected absence with `Option.Option<A>` rather than `A | undefined`.
  Repositories describe persistence outcomes; use cases decide whether absence
  stays optional or becomes a domain error.
- Requirements must be `never` — repos should not leak their own dependencies.

### Use Cases

Use cases are classes with constructor injection. The `execute` method returns
an `Effect`:

```ts
import { Effect, Option } from "effect";

export class UpdateExampleItemUseCase {
  constructor(private readonly exampleItemRepository: ExampleItemRepository) {}

  execute(
    id: string,
    input: UpdateExampleItemInput,
  ): Effect.Effect<ExampleItem, ExampleItemNotFoundError | DatabaseError> {
    return Effect.gen(this, function* () {
      const item = yield* this.exampleItemRepository.update(id, input);

      if (Option.isNone(item)) {
        return yield* new ExampleItemNotFoundError({ id });
      }

      return item.value;
    });
  }
}
```

**Rules:**

- Use `Effect.gen(this, function* () { ... })` when you need to access `this`.
- Use `yield*` to unwrap effects — never `await`.
- The return type must be explicit — it documents the error contract.
- Map infrastructure errors to domain errors when appropriate.
- For simple pass-through operations (no logic), return the repository effect
  directly without wrapping in `Effect.gen`.

---

## Data Layer

### Repository Implementations

Wrap all I/O in `Effect.tryPromise` to capture errors as typed `DatabaseError`:

```ts
import { Effect } from "effect";
import { DatabaseError } from "../../domain/errors/DatabaseError.js";

export class ExampleItemDatabaseRepository implements ExampleItemRepository {
  constructor(private readonly db: Database) {}

  get list(): Effect.Effect<ExampleItem[], DatabaseError> {
    return Effect.tryPromise({
      try: () => this.db.select().from(exampleItems),
      catch: (cause) => new DatabaseError({ cause }),
    });
  }
}
```

**Rules:**

- Always use the object form of `Effect.tryPromise({ try, catch })` so that
  errors are mapped to domain error types.
- Convert repository anomalies into the repository's typed infrastructure error
  (usually `DatabaseError`). For example, if an insert unexpectedly returns no
  row, fail with `DatabaseError` rather than introducing a one-off error type.
- Use `Effect.map`, `Effect.flatMap`, and `Effect.pipe` for transformations —
  avoid `async/await` inside Effect code.
- Use `get` property syntax for parameter-less methods to match the interface.

---

## API Layer

### Route Handlers

Run effects at the HTTP boundary using `Effect.runPromise`:

```ts
server.get("/example-items", {
  schema: ExampleItemSchemas.list,
  handler: async () => {
    const items = await Effect.runPromise(compositionRoot.exampleItems.listExampleItems.execute());
    return { items: items.map(serializeExampleItem) };
  },
});
```

**For operations that may fail with expected errors**, use `Effect.either` to
inspect the result without throwing:

```ts
import { Effect, Either, Match } from "effect";

server.put("/example-items/:id", {
  handler: async (request, reply) => {
    const result = await Effect.runPromise(
      useCase.execute(id, input).pipe(Effect.either),
    );

    if (Either.isLeft(result)) {
      return Match.value(result.left).pipe(
        Match.tag("ExampleItemNotFoundError", () =>
          reply.code(404).send({ ... }),
        ),
        Match.orElse((error) => {
          throw error;
        }),
      );
    }

    return serializeExampleItem(result.right);
  },
});
```

**Rules:**

- `Effect.runPromise` is the **only** runner used in route handlers.
- Use `Effect.either` when you need to handle specific error types in the route.
- Use `Either.isLeft` / `Either.isRight` instead of direct `_tag` checks.
- Throw unhandled typed errors so Fastify's error handler receives the original error.
- Never run effects in the domain or data layer — those layers only build
  effect descriptions.
- Keep HTTP concerns in the API layer. Use cases should not return DTOs,
  Fastify replies, or HTTP status codes.

---

## Choosing the Right Effect Shape

Use the smallest Effect construct that makes the code clear:

| Case                                     | Prefer             |
| ---------------------------------------- | ------------------ |
| Returning another effect unchanged       | Return it directly |
| Transforming only the success value      | `Effect.map`       |
| Chaining one effect into another         | `Effect.flatMap`   |
| Sequencing several effects with branches | `Effect.gen`       |
| Running independent effects together     | `Effect.all`       |
| Recovering one expected error tag        | `Effect.catchTag`  |
| Handling tagged union values             | `Match`            |

Examples:

```ts
// Pass-through: no gen needed
execute(): Effect.Effect<ExampleItem[], DatabaseError> {
  return this.exampleItemRepository.list;
}

// One transformation: map is enough
execute(): Effect.Effect<string[], DatabaseError> {
  return this.exampleItemRepository.list.pipe(
    Effect.map((items) => items.map((item) => item.name)),
  );
}

// Sequencing and branching: gen is clearer
execute(id: string): Effect.Effect<ExampleItem, ExampleItemNotFoundError | DatabaseError> {
  return Effect.gen(this, function* () {
    const item = yield* this.exampleItemRepository.update(id, input);
    if (Option.isNone(item)) return yield* new ExampleItemNotFoundError({ id });
    return item.value;
  });
}
```

---

## Pattern Matching

Effect's `Match` module is useful when handling tagged unions such as
`Data.TaggedError` values. Prefer it when there are multiple meaningful cases or
when exhaustiveness would make the code safer:

```ts
import { Match } from "effect";

const toHttpStatus = Match.type<ExampleItemNotFoundError | DatabaseError>().pipe(
  Match.tagsExhaustive({
    ExampleItemNotFoundError: () => 404,
    DatabaseError: () => 500,
  }),
);
```

For boundary code that intentionally handles one known case and lets the rest
bubble up, use `Match.orElse`:

```ts
Match.value(error).pipe(
  Match.tag("ExampleItemNotFoundError", () => reply.code(404).send({ ... })),
  Match.orElse((unhandled) => {
    throw unhandled;
  }),
);
```

**Rules:**

- Use `_tag`-based matching (`Match.tag`, `Match.tagsExhaustive`) for
  `Data.TaggedError` values.
- Use exhaustive matching when all cases are known and should be handled locally.
- Do not use `Match` for trivial boolean logic where an `if` is clearer.

---

## Composition Root

The `CompositionRoot` uses constructor injection to wire dependencies:

```ts
export function createCompositionRoot(environment: Environment): CompositionRoot {
  const databaseClient = createDatabaseClient(environment.DATABASE_URL);
  const repo = new ExampleItemDatabaseRepository(databaseClient.db);

  return {
    exampleItems: {
      listExampleItems: new ListExampleItemsUseCase(repo),
      createExampleItem: new CreateExampleItemUseCase(repo),
    },
    close: () => databaseClient.close(),
  };
}
```

**Rules:**

- All wiring happens in `CompositionRoot.ts` — no service construction
  elsewhere.
- The `CompositionRoot` type exposes use case instances grouped by domain
  aggregate.
- Test code may create a `CompositionRoot` with mock repositories.

---

## Dependency Injection Policy

This project uses constructor injection and a manual `CompositionRoot` by
default. That is intentional:

- It is familiar to developers coming from Clean Architecture codebases.
- Use case requirements stay resolved before the HTTP boundary.
- Effect stays focused on typed errors and composition instead of teaching every
  Effect concept at once.

Effect `Context` / `Layer` is a good option for larger apps with many services,
shared resource lifecycles, or Effect-native integrations. Do not introduce it
until manual wiring becomes noisy enough to justify the extra abstraction.

---

## Error Handling Strategy

### Two Types of Errors

| Type               | How to model                            | How to handle                               |
| ------------------ | --------------------------------------- | ------------------------------------------- |
| **Expected error** | `Data.TaggedError` in the error channel | `Effect.catchTag`, `Effect.either`, `Match` |
| **Defect (bug)**   | `Effect.die` / unhandled throw          | Crashes the fiber; caught by Fastify        |

### Error Flow

```
Repository (DatabaseError)
    ↓
Use Case (maps to domain errors, e.g., ExampleItemNotFoundError)
    ↓
Route Handler (maps domain errors to HTTP status codes)
    ↓
Fastify Error Handler (catches unhandled errors → 500)
```

### Key Patterns

**Failing with a typed error:**

```ts
return yield * new ExampleItemNotFoundError({ id });
```

**Catching all errors (e.g., health check):**

```ts
this.healthRepository.check.pipe(Effect.catchAll(() => Effect.succeed({ reachable: false })));
```

**Catching a specific error by tag:**

```ts
effect.pipe(Effect.catchTag("ExampleItemNotFoundError", (error) => Effect.succeed(/* fallback */)));
```

**Wrapping a Promise-based API:**

```ts
Effect.tryPromise({
  try: () => someAsyncCall(),
  catch: (cause) => new DatabaseError({ cause }),
});
```

---

## Testing with Effect

### Unit Tests

Use `Effect.runPromise` (or `Effect.runPromiseExit` for error assertions):

```ts
it("returns all items", async () => {
  const useCase = new ListExampleItemsUseCase(mockRepo);
  const result = await Effect.runPromise(useCase.execute());
  expect(result).toHaveLength(2);
});
```

### Asserting Errors

Use `Effect.runPromiseExit` to inspect the `Exit` value:

```ts
it("fails when item not found", async () => {
  const exit = await Effect.runPromiseExit(useCase.execute("nonexistent", { name: "x" }));

  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit) && Cause.isFailType(exit.cause)) {
    expect(exit.cause.error).toBeInstanceOf(ExampleItemNotFoundError);
  }
});
```

### Mock Repositories

Mock repos return `Effect.succeed` / `Effect.fail` / `Effect.sync`:

```ts
export function createExampleItemMockRepository(items: ExampleItem[] = []): ExampleItemRepository {
  return {
    list: Effect.sync(() => [...items]),
    create: (input) =>
      Effect.sync(() => {
        const item = { ...input, createdAt: fixedDate };
        items.push(item);
        return item;
      }),
    update: (id, input) =>
      Effect.sync(() => {
        const existing = items.find((i) => i.id === id);
        if (!existing) return Option.none();
        Object.assign(existing, input);
        return Option.some(existing);
      }),
  };
}
```

**Rules:**

- Use `Effect.sync` for mock operations with side effects (mutating arrays).
- Use `Effect.succeed` for pure mock values.
- Use `Effect.fail` to simulate infrastructure errors in tests.

---

## Keep It Simple

Effect is a tool, not the architecture. Prefer ordinary TypeScript when it is
clearer:

- Do not add base use-case classes.
- Do not add generic repository superclasses.
- Do not add route helpers until repeated route error handling makes them useful.
- Do not add Effect DI, Effect Schema, or Effect SQL unless the project moves in
  that direction intentionally.
- Keep domain entities as plain TypeScript values.

Useful additions when the app grows:

- `Effect.all` for parallel readiness checks or independent repository calls.
- `Effect.timeout` for external services that should not block requests forever.
- `Effect.retry` for transient external failures.
- `@effect/vitest` if test assertions around effects become noisy.

---

## Anti-Patterns to Avoid

### 1. Mixing `async/await` with Effect

```ts
// ❌ Bad — breaks composability
async execute(): Promise<ExampleItem> {
  const item = await Effect.runPromise(this.repo.create(input));
  return item;
}

// ✅ Good — stays in Effect world
execute(): Effect.Effect<ExampleItem, DatabaseError> {
  return this.repo.create(input);
}
```

### 2. Leaking requirements

```ts
// ❌ Bad — use case exposes Requirements
execute(): Effect.Effect<ExampleItem, DatabaseError, DatabaseService> {
  // ...
}

// ✅ Good — Requirements is `never`, deps injected via constructor
execute(): Effect.Effect<ExampleItem, DatabaseError> {
  // ...
}
```

### 3. Catching errors too broadly

```ts
// ❌ Bad — silences all errors including defects
effect.pipe(Effect.catchAllCause(() => Effect.succeed(fallback)));

// ✅ Good — only catches expected errors
effect.pipe(Effect.catchAll(() => Effect.succeed(fallback)));
```

### 4. Using `Effect.die` for expected conditions

```ts
// ❌ Bad — "not found" is an expected outcome
if (!item) return Effect.die(new Error("Not found"));

// ✅ Good — use a tagged error
if (!item) return yield * new ExampleItemNotFoundError({ id });
```

In repositories, prefer the repository's infrastructure error for operational
failures and surprising external results:

```ts
// ✅ Good — repository keeps its error channel uniform
if (!item) {
  return Effect.fail(new DatabaseError({ cause: "Failed to insert example item" }));
}
```

### 5. Using `undefined` for expected absence at the repository boundary

```ts
// ❌ Bad — absence is implicit and easy to forget
update(id: string): Effect.Effect<ExampleItem | undefined, DatabaseError> {
  // ...
}

// ✅ Good — absence is explicit in the success channel
update(id: string): Effect.Effect<Option.Option<ExampleItem>, DatabaseError> {
  // ...
}
```

Use the repository to model storage outcomes and the use case to decide whether
`Option.none()` remains optional behavior or becomes a domain error such as
`ExampleItemNotFoundError`.

### 6. Running effects inside the domain layer

```ts
// ❌ Bad — runs the effect eagerly in the domain
async execute() {
  return await Effect.runPromise(this.repo.list);
}

// ✅ Good — returns the effect description
execute(): Effect.Effect<ExampleItem[], DatabaseError> {
  return this.repo.list;
}
```

---

## Quick Reference

| Task                      | API                                 |
| ------------------------- | ----------------------------------- |
| Wrap a sync value         | `Effect.succeed(value)`             |
| Wrap a sync side effect   | `Effect.sync(() => value)`          |
| Wrap a Promise            | `Effect.tryPromise({ try, catch })` |
| Fail with typed error     | `yield* new MyError({ ... })`       |
| Signal a defect (bug)     | `Effect.die(error)`                 |
| Chain effects             | `Effect.gen(function* () { ... })`  |
| Transform success         | `Effect.map(effect, fn)`            |
| Chain with another effect | `Effect.flatMap(effect, fn)`        |
| Catch all expected errors | `Effect.catchAll(effect, handler)`  |
| Catch error by tag        | `Effect.catchTag("Tag", handler)`   |
| Convert errors to Either  | `Effect.either(effect)`             |
| Run effect (async)        | `Effect.runPromise(effect)`         |
| Run effect (sync)         | `Effect.runSync(effect)`            |
| Inspect exit value        | `Effect.runPromiseExit(effect)`     |
