# Chapter 16 — issue a reproducible management report

## Walkthrough

Open **Management reports**, select a portfolio and an exact valuation. The valuation supplies the economic as-of; the evidence cutoff controls which recorded snapshots can be used. Matching optional selectors prevent combining a monitor or performance result with a different ending valuation. The API repeats every check.

Generate the report and inspect coverage before its headline NAV. Holdings plus economic cash reconcile to NAV; pending payables are already in economic cash. Missing sections remain missing. Each observation links to the chapter where a reviewer can investigate its frozen evidence.

## Review and export

A draft with missing or exception sections requires explicit acknowledgment before approval. Approval creates a new revision while preserving financial evidence. Chapter 17 supplies authenticated authority and separation of duties.

Switch between revisions, compare NAV and coverage, and export the selected revision as JSON or CSV. JSON contains full typed evidence. CSV quotes cells and neutralizes formula-like user text. Print uses the same frozen sections and hides editing controls.

In the independent API example, ten shares at 100 plus economic cash 9,000 produce NAV 10,000. A later mark of 110 creates a superseding report at 10,100. The approved prior JSON and CSV remain byte-for-byte unchanged. A reconciliation break appears as an exception; missing performance does not become zero.

## Recording sequence

Select valuation → expose missing coverage → inspect NAV tie → follow evidence → attempt incomplete approval → acknowledge limitations → issue revision → export and print → change a price → supersede → revisit the unchanged issued report.

Read the [definition contract](16-definition-contract.md). Reports are educational management artifacts, not regulatory filings. Source decision dates can precede the report; every source retains its own time and method. Printable HTML is implemented; PDF generation is outside this chapter.
