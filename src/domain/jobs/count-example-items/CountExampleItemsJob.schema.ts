import { z } from "zod";

export const countExampleItemsJobInputSchema = z.object({
  sleepMs: z.number().int().min(0).max(60_000),
});

export type CountExampleItemsJobInput = z.infer<typeof countExampleItemsJobInputSchema>;
