export class ApplicationError extends Error {
  constructor(
    public readonly code:
      "NOT_FOUND" | "REVISION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "CURRENCY_IN_USE",
    message: string,
  ) {
    super(message);
  }
}
