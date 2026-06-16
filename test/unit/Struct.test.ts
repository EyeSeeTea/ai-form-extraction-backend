import { describe, expect, expectTypeOf, it } from "vitest";

import { Struct } from "../../src/domain/entities/generic/Struct.js";

class Person extends Struct<{ name: string; age: number }>() {
  description(): string {
    return `${this.name} has ${String(this.age)} years`;
  }

  withAge(age: number): this {
    return this._update({ age });
  }
}

describe("Struct", () => {
  it("assigns attributes as public properties", () => {
    const person = new Person({ name: "Mary Cassatt", age: 54 });

    expect(person.name).toBe("Mary Cassatt");
    expect(person.age).toBe(54);
    expect(person.description()).toBe("Mary Cassatt has 54 years");
  });

  it("creates instances from attributes", () => {
    const person = Person.create({ name: "Berthe Morisot", age: 44 });

    expectTypeOf(person).toEqualTypeOf<Person>();
    expect(person._getAttributes()).toEqual({ name: "Berthe Morisot", age: 44 });
  });

  it("updates attributes immutably", () => {
    const person = new Person({ name: "Mary Cassatt", age: 54 });
    const updated = person.withAge(55);

    expect(updated).toBeInstanceOf(Person);
    expect(updated._getAttributes()).toEqual({ name: "Mary Cassatt", age: 55 });
    expect(person._getAttributes()).toEqual({ name: "Mary Cassatt", age: 54 });
  });
});
