# Chapter 16 — one report, one frozen evidence set

## Clocks, scope and consistency

Report asOf is the economic valuation cutoff. dataCutoff is the latest allowed recorded evidence time; both must be at or before creation, and dataCutoff cannot precede asOf. Select exact source revisions. The selected valuation must belong to the portfolio and equal report asOf. The monitor and ending performance valuation must reference that exact valuation. Reconciliation must use the same book checkpoint and statement cutoff. Orders must belong to the portfolio and have no fills beyond its checkpoint.

Target/research/data sources are decision context with their own earlier economic dates and recorded availability; their distinct dates remain visible. Their instruments must belong to the selected portfolio holdings, target or orders universe. Missing evidence is a visible section state, never an implied completed capability. With no valuation, holdings/NAV/operations/risk/performance are unavailable or rejected if supplied inconsistently.

Holdings base values plus economic cash must equal NAV in cents. Deferred payables/receivables are already included in economic cash; show pending amounts separately without subtracting liabilities twice. Statements and operational breaks do not overwrite valuation balances.

## Sections and insights

Freeze overview, holdings/cash, quality, research, construction, orders, operations, risk, performance and attribution. Every section has source references, a state and method notes. Deterministic insights state a supported observation and a bounded review action. No buy/sell advice or generated causal explanation is inserted.

JSON preserves the complete report and selected typed evidence. CSV serializes the frozen section rows with report ID/revision, section, subject, metric, value, unit, currency, source and asOf. CSV cells are quoted; potentially formula-like leading characters (after whitespace) receive an apostrophe. This export intentionally treats such cells as text. JSON preserves the unmodified values.

React and print consume the same stored report; exports never rerun valuation, analytics or provider queries. Print is HTML/CSS, not a regulatory PDF or jurisdiction-specific filing.

## Immutable history and approval

A new report begins draft revision 1. Approval requires expected revision, actor and reason; exceptions require explicit acknowledgment. Approval creates another immutable revision with unchanged financial evidence. Chapter 17 supplies server-authenticated authority and separation of duties.

A new calculation can supersede an exact latest report revision for the same portfolio, keeping the report ID and advancing revision. Old references and exports remain readable. New prices cannot mutate an issued report. History and comparison show the selected revisions, NAV, coverage and source references.

This is an educational management report. Approval records review, not certification of missing evidence, legal compliance or investment suitability.
