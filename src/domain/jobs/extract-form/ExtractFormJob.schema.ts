import { z } from "zod";

import { uploadedDocumentInputSchema } from "../../uploads/UploadedDocument.js";
import { knownFormTypes } from "../../forms/FormRegistry.js";

export const extractFormJobInputSchema = z.object({
  formType: z.enum(knownFormTypes),
  document: uploadedDocumentInputSchema,
});

export type ExtractFormJobInput = z.infer<typeof extractFormJobInputSchema>;
