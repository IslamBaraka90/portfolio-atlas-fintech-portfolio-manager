import { z } from "zod";
import { candidateAllocationSchema, mandateInputSchema } from "./mandates.js";

export const lessonSchema = z.strictObject({
  mandate: mandateInputSchema,
  scenarios: z.array(
    z.strictObject({ id: z.string(), label: z.string(), allocation: candidateAllocationSchema }),
  ),
});
export type Lesson = z.infer<typeof lessonSchema>;
