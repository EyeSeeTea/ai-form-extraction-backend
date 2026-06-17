import type { Future } from "../entities/generic/Future.js";
import type { ExampleItem } from "../entities/ExampleItem.js";
import type { Maybe } from "../../utils/ts-utils.js";

export interface ExampleItemRepository {
  list(): Future<Error, ExampleItem[]>;
  create(input: Pick<ExampleItem, "name">): Future<Error, ExampleItem>;
  update(id: string, input: Pick<ExampleItem, "name">): Future<Error, Maybe<ExampleItem>>;
}
