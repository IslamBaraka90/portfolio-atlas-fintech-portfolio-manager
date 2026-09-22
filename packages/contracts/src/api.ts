import { z } from "zod";

export const metadataSchema = z.strictObject({
  schemaVersion: z.literal("1"),
  mode: z.enum(["synthetic", "yahoo", "mixed"]),
  storage: z.enum(["memory", "sqlite"]),
  sessionId: z.string(),
  generatedAt: z.iso.datetime(),
});
export function envelopeSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({ data, metadata: metadataSchema, requestId: z.string() });
}
export type ResponseMetadata = z.infer<typeof metadataSchema>;
export interface ApiEnvelope<T> {
  data: T;
  metadata: ResponseMetadata;
  requestId: string;
}
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields: { path: string; message: string }[];
  };
  requestId: string;
}
