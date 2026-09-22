import type { ReportSnapshot } from "@portfolio-atlas/contracts";
// Quoting alone does not stop spreadsheets from interpreting formulas.
export function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function reportCsv(report: ReportSnapshot) {
  const columns = [
    "report_id",
    "revision",
    "section",
    "subject",
    "metric",
    "value",
    "unit",
    "currency",
    "source_ref",
    "source_revision",
    "as_of",
  ];
  const rows = report.sections.flatMap((section) =>
    section.rows.map((row) => [
      report.id,
      String(report.revision),
      section.key,
      row.subject,
      row.metric,
      row.value ?? "unavailable",
      row.unit,
      row.currency ?? "",
      row.sourceRef,
      String(section.sources.find((s) => s.id === row.sourceRef)?.revision ?? ""),
      section.asOf,
    ]),
  );
  return [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function reportJson(report: ReportSnapshot) {
  return JSON.stringify(report, null, 2) + "\n";
}
