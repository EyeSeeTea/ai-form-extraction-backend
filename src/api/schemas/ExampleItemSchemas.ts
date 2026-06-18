import { z } from "zod";

import { errorResponse, validationErrorResponse } from "./ErrorSchemas.js";
import { schemaRegistry } from "./SchemaRegistry.js";

const exampleItemBody = z.object({
  name: z.string().min(1),
});

const exampleItemParams = z.object({
  id: z.uuid(),
});

const authenticatedRoute = {
  security: [{ Authentication: [] }],
} as const;

export const exampleItemResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.string(),
});

export type ExampleItemDto = z.infer<typeof exampleItemResponse>;

schemaRegistry.add(exampleItemResponse, { id: "ExampleItem" });

export const ExampleItemSchemas = {
  list: {
    ...authenticatedRoute,
    tags: ["Example Items"],
    response: {
      200: z.object({ items: z.array(exampleItemResponse) }),
    },
  },
  create: {
    ...authenticatedRoute,
    tags: ["Example Items"],
    body: exampleItemBody,
    response: {
      201: exampleItemResponse,
      400: validationErrorResponse,
    },
  },
  update: {
    ...authenticatedRoute,
    tags: ["Example Items"],
    params: exampleItemParams,
    body: exampleItemBody,
    response: {
      200: exampleItemResponse,
      400: validationErrorResponse,
      404: errorResponse,
    },
  },
} as const;
