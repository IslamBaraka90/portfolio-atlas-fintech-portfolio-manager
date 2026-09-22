import { z } from "zod";
import { envelopeSchema, type ApiEnvelope } from "@portfolio-atlas/contracts";

const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.object({ path: z.string(), message: z.string() })),
  }),
  requestId: z.string(),
});
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string,
  ) {
    super(message);
  }
}

export async function read<T>(
  path: string,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<ApiEnvelope<T>> {
  return request(path, schema, { ...(signal ? { signal } : {}) });
}

// Reusing a key for the same command makes a network retry safe. The server still
// owns conflict detection. Nothing is persisted in browser storage.
const commandKeys = new Map<string, string>();
export async function write<T>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
) {
  const fingerprint = JSON.stringify({ method, path, body });
  const key = commandKeys.get(fingerprint) ?? crypto.randomUUID();
  commandKeys.set(fingerprint, key);
  return request(path, schema, {
    method,
    headers: { "content-type": "application/json", "idempotency-key": key },
    body: JSON.stringify(body),
  });
}
export function resetCommandKeys() {
  commandKeys.clear();
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit,
): Promise<ApiEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch("/api/v1" + path, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error("The API is unavailable. Check that npm run dev is running, then retry.");
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body);
    if (parsed.success)
      throw new ApiError(
        parsed.data.error.code,
        [
          parsed.data.error.message,
          ...parsed.data.error.fields.map((field) => field.path + ": " + field.message),
        ].join(" "),
        parsed.data.requestId,
      );
    throw new Error("The server returned an unexpected response. Reload the session.");
  }
  return envelopeSchema(schema).parse(body);
}
