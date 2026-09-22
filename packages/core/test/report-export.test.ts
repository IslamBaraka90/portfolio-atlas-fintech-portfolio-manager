import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "../src/domain/reporting/export-report.js";
test("spreadsheet CSV quotes separators and forces formula-like text to remain text", () => {
  assert.equal(csvCell("=2+2"), '"\'=2+2"');
  assert.equal(csvCell("  @SUM(A1)"), '"\'  @SUM(A1)"');
  assert.equal(csvCell("-100.00"), '"\'-100.00"');
  assert.equal(csvCell("\t=HYPERLINK(1)"), '"\'\t=HYPERLINK(1)"');
  assert.equal(csvCell('Sector, "quoted"'), '"Sector, ""quoted"""');
});
