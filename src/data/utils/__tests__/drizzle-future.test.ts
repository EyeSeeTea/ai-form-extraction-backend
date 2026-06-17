import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { DbError, toDbError } from "../drizzle-future.js";

describe("toDbError", () => {
  it("wraps unknown errors with operation context", () => {
    const error = toDbError(new Error("boom"), "list example items");

    expect(error).toBeInstanceOf(DbError);
    expect(error.kind).toBe("unknown");
    expect(error.operation).toBe("list example items");
    expect(error.message).toBe("boom");
  });

  it("preserves Drizzle query details", () => {
    const cause = Object.assign(new Error("constraint failed"), {
      name: "SqliteError",
      code: "SQLITE_CONSTRAINT",
    });
    const error = toDbError(new DrizzleQueryError("select 1", [], cause), "create example item");

    expect(error.kind).toBe("sqlite");
    expect(error.operation).toBe("create example item");
    expect(error.query).toBe("select 1");
    expect(error.params).toEqual([]);
    expect(error.code).toBe("SQLITE_CONSTRAINT");
    expect(error.causeName).toBe("SqliteError");
  });
});
