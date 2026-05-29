import type { ExampleItem } from "../../domain/entities/ExampleItem.js";
import type { ExampleItemDto } from "../schemas/ExampleItemSchemas.js";

export function serializeExampleItem(item: ExampleItem): ExampleItemDto {
  return { ...item, createdAt: item.createdAt.toISOString() };
}
