import { z } from "zod";

export const schemaRegistry = z.registry<{ id: string }>();
