/**
 * Base class for typical classes with attributes. Features: create, update.
 *
 * ```
 * class Counter extends Struct<{ id: Id; value: number }>() {
 *   add(value: number): Counter {
 *     return this._update({ value: this.value + value });
 *   }
 * }
 *
 * const counter1 = Counter.create({ id: "some-counter", value: 1 });
 * const counter2 = counter1._update({ value: 2 });
 * ```
 */
export abstract class StructBase<Attrs extends object> {
  constructor(attributes: Attrs) {
    Object.assign(this, attributes);
  }

  _getAttributes(): Attrs {
    const self = this as Record<string, unknown>;
    const entries = Object.getOwnPropertyNames(this).map((key) => [key, self[key]] as const);
    return Object.fromEntries(entries) as Attrs;
  }

  protected _update(partialAttrs: Partial<Attrs>): this {
    const ParentClass = this.constructor as new (values: Attrs) => typeof this;
    return new ParentClass({ ...this._getAttributes(), ...partialAttrs });
  }

  static create<Attrs extends object, U extends StructBase<Attrs>>(
    this: new (attrs: Attrs) => U,
    attrs: Attrs,
  ): U {
    return new this(attrs);
  }
}

export function Struct<Attrs extends object>() {
  return StructBase as {
    new (values: Attrs): Attrs & StructBase<Attrs>;
    create: typeof StructBase.create;
  };
}

export type GenericStructInstance = StructBase<object>;
