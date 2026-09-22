# Chapter 1 — Definition contract

Status: implementation specification. These are explicit teaching policies, not claims that a regulator prescribes these limits.

## What a mandate means here

A mandate names the portfolio's objective, base currency, horizon, allowed asset types, cash bounds, single-instrument and assigned-sector limits, and restricted internal instrument IDs. The objective and horizon are descriptive; this chapter does not derive a suitability score from them.

Weights are fractions of the whole candidate allocation including cash. Input precision is one basis point: 0.0001. The API accepts fractions; the screen edits percentages. The domain converts valid fractions to integer basis points before adding and comparing, making exact boundaries reproducible.

Cash is a separate allocation field. It does not consume the single-position or sector cap. Security positions are equities or ETFs. Sector classification is a synthetic, client-supplied assertion in this chapter, not a verified security master or ETF look-through exposure. Chapter 2 strengthens identity. Zero-weight rows are unheld and do not trigger exposure restrictions.

## Consistency before compliance

First validate wire types, finite values, precision and allowed fields. Next test policy consistency, duplicate instrument IDs, and whether total weight equals 10,000 basis points.

A saved mandate is a draft policy. Contradictory cash bounds or an impossible cash-only configuration may be saved for teaching, but evaluation must report invalid and never satisfied. Feasibility here is a small set of consistency checks, not an optimizer or proof that a real universe can satisfy every constraint.

On a structurally valid allocation, evaluate cash minimum/maximum, each held instrument's position cap, asset-type eligibility, restricted IDs, and aggregate sector caps. Unknown held-sector labels produce not_evaluable. A known breach still produces breached even when another rule is unknown; all reasons remain visible.

Overall precedence: invalid, then breached, then not_evaluable, then satisfied. Evidence includes observed value, limit, comparison, unit, subject and explanation.

## Time and revisions

Every saved policy revision is immutable. Edits use expectedRevision; old revisions remain inspectable. Evaluations target the current revision and carry a candidate asOf. A cutoff before that revision became effective, or after the server's evaluation time, cannot claim a historical policy verdict.

The clock and identifier factory are injected for deterministic tests. Mutations require idempotency keys: same key and normalized command returns the prior result, while reuse with changed input is a conflict. The in-memory implementation is atomic within one synchronous process and makes no durability or distributed-concurrency claim.

## Independent examples

| Case                | Arithmetic                         | Expected decision                                     |
| ------------------- | ---------------------------------- | ----------------------------------------------------- |
| Balanced            | 40% + 30% + 20% + 10% cash = 100%  | Satisfied at the 40% position and 10% cash boundaries |
| Concentrated        | 60% + 20% + 10% + 10% cash = 100%  | Position and technology-sector limits breached        |
| Underfunded reserve | 40% + 35% + 20% + 5% cash = 100%   | Cash minimum breached                                 |
| Bad total           | 40% + 30% + 30% + 10% cash = 110%  | Invalid allocation                                    |
| Unknown sector      | A positive holding has null sector | Not evaluable if no known breach                      |
| Conflicting policy  | Minimum cash 60%, maximum cash 20% | Invalid policy                                        |

These examples are authored independently of the evaluator; tests must assert decisions and observed values, not copy its arithmetic.

## Engineering references

- [Zod schemas and inferred types](https://zod.dev/basics): validate the wire boundary once.
- [Vite proxy configuration](https://vite.dev/config/server-options.html#server-proxy): the browser uses our API through a development proxy.
- [Fastify injection testing](https://fastify.dev/docs/latest/Guides/Testing/): exercise HTTP behavior without binding a port.
- [Playwright web-server lifecycle](https://playwright.dev/docs/test-webserver): verify the connected browser workflow.

No fintech-algorithms export is used for these application-specific mandate rules. D33 and D45 remain outside the pinned package. D14 is not needed for this chapter.
