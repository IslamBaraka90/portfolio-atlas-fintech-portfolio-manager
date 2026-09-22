import { currentSession, refreshSession } from "./session";
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

// Retain a command key until a valid success response arrives, so uncertain retries
// are safe. A later deliberate submission is a new command, even with the same body.
const commandKeys = new Map<string, string>();
export async function write<T>(
  method: "POST" | "PUT",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
) {
  const session = currentSession() ?? (await refreshSession());
  const fingerprint = JSON.stringify({ actor: session.actor?.id, method, path, body });
  const key = commandKeys.get(fingerprint) ?? crypto.randomUUID();
  commandKeys.set(fingerprint, key);
  const result = await request(path, schema, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": key,
      ...(session.csrf ? { "x-csrf-token": session.csrf } : {}),
    },
    body: JSON.stringify(body),
  });
  if (commandKeys.get(fingerprint) === key) commandKeys.delete(fingerprint);
  return result;
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
    if (response.status === 401) void refreshSession().catch(() => {});
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
