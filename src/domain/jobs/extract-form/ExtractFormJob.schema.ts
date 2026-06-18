import { z } from "zod";

export const extractFormJobInputSchema = z.object({
  formId: z.string().min(1),
  sourceUrl: z.url(),
});

export type ExtractFormJobInput = z.infer<typeof extractFormJobInputSchema>;
