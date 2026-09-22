# Chapter 14 — know what needs attention

## Walkthrough

Create a current Chapter 6 valuation. Open **Monitoring & alerts**, select it, optionally add a Chapter 8 simple-return history and Chapter 9 target, then run the monitor. The newest portfolio valuation is required. A changed book or evidence older than one hour makes the run unavailable.

The independent fixture holds 10 shares at 100 within NAV 10,000. A −10% price shock changes the position by −100. The 40/40/20 target changes by −800, with FX fixed and cash unchanged. Position, sector and currency tables show their NAV denominator. Proposed target weights are pre-cost illustrations.

Historical losses apply today's weights to every aligned sample interval, resetting daily and paying zero interest on cash. This is not the account's realized performance. The loss plot shows observations and the interpolated 95% quantile; it does not claim a worst possible loss. A 100→80→80 wealth path independently produces 20% maximum drawdown and a 19% interpolated loss quantile for two intervals.

## Alert workflow

An initial 90% cash weight exceeds the demo mandate's 30% ceiling. Run the same review again: one finding gains another observation revision, not another duplicate alert. Acknowledge it with an actor and reason. The breach remains.

Post another journal event and rerun against the old valuation. The screen reports unavailable evidence. Resolving the acknowledged cash finding fails because stale data cannot prove a pass. In the API fixture, a new balanced 40/40/20 valuation produces a passing observation; explicit resolution succeeds. Exactly 40% position weights pass the 40% ceiling.

Resolved findings reopen when a new breach or unavailable observation appears. Old snapshots preserve their original observations. Changed mandate revisions have separate identities and cannot silently clear earlier policy findings.

## Source and method evidence

Read the [definition contract](14-definition-contract.md), MonitorService, monitorPortfolio and FintechMonitorAnalytics. D00-F11-A03 and A05 were looked up against installed 0.13.2 and checked against hand-derived examples. Their catalog tier is verified shared-fixture parity.

The API exposes full valuation, mandate, instrument revisions, target and risk-model evidence. Unknown sectors, absent target/history, unsupported currency/return conventions and missing liquidity assumptions stay unavailable. The fixed thresholds are authored teaching rules, not suitability or regulatory judgments.

## Recording sequence

Concentration table → −10% shock → historical loss dots and VaR convention → repeated breach → acknowledgment → changed book → stale-resolution rejection → fresh passing observation → explicit resolution.

Chapter 15 computes actual cash-flow-aware performance from frozen valuations and recorded external flows.
