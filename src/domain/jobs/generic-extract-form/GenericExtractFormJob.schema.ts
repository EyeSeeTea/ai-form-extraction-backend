import { z } from "zod";

import { uploadedDocumentInputSchema } from "../../uploads/UploadedDocument.js";
import {
  genericExtractFormFormSchema,
  genericExtractFormOutputSchema,
  genericExtractFormProfileSchema,
  genericExtractFormPromptSchema,
} from "./GenericExtractFormContract.js";

export const genericExtractFormJobInputSchema = z.object({
  form: genericExtractFormFormSchema,
  profile: genericExtractFormProfileSchema,
  prompt: genericExtractFormPromptSchema,
  outputSchema: genericExtractFormOutputSchema,
  document: uploadedDocumentInputSchema,
});

export type GenericExtractFormJobInput = z.infer<typeof genericExtractFormJobInputSchema>;
