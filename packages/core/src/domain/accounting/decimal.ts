import { Decimal } from "decimal.js";
import { postingInputSchema, type PostingInput } from "@portfolio-atlas/contracts";
import { ApplicationError } from "../../use-cases/errors.js";
export const BookDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export const zero = () => new BookDecimal("0");
const limit = new BookDecimal("999999999999.99");
export function invalid(message: string): never {
  throw new ApplicationError("INVALID_EVENT", message);
}
export function cents(value: Decimal): Decimal {
  if (!value.isFinite() || value.abs().gt(limit))
    invalid("Amount exceeds the bounded book-money policy.");
  return value.toDecimalPlaces(2);
}
export function money(value: Decimal): string {
  if (value.isNegative()) invalid("This book amount cannot be negative.");
  return cents(value).toFixed(2);
}
export function signedMoney(value: Decimal): string {
  return cents(value).toFixed(2);
}
export function quantity(value: Decimal): string {
  if (
    !value.isFinite() ||
    value.isNegative() ||
    value.gt("999999999999.99999999") ||
    value.decimalPlaces() > 8
  )
    invalid("Share quantity requires unsupported precision or exceeds the quantity bound.");
  return value.toFixed(8);
}
export function unitCost(cost: Decimal, shares: Decimal): string {
  return shares.isZero() ? "0.00000000" : cost.div(shares).toFixed(8);
}
export function normalizePosting(value: PostingInput): PostingInput {
  const input = postingInputSchema.parse(value);
  if ("amount" in input) input.amount = money(new BookDecimal(input.amount));
  if ("quantity" in input) input.quantity = quantity(new BookDecimal(input.quantity));
  if ("unitPrice" in input) input.unitPrice = quantity(new BookDecimal(input.unitPrice));
  if ("fee" in input) input.fee = money(new BookDecimal(input.fee));
  if ("ratio" in input) input.ratio = quantity(new BookDecimal(input.ratio));
  return input;
}
