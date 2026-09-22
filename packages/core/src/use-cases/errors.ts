export class ApplicationError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "REVISION_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "CURRENCY_IN_USE"
      | "INVALID_EVENT"
      | "INVALID_SNAPSHOT"
      | "BOOK_INVARIANT"
      | "CORRECTION_CONFLICT",
    message: string,
  ) {
    super(message);
  }
}
