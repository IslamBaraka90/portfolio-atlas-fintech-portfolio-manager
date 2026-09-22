# Chapter 1 recording notes — Start with a mandate

Target duration: approximately 25–35 minutes, adjusted to the explanation pace. No rendered video or narration is produced in this chapter.

## Preparation

Use the [learning guide](../chapters/01-learning-guide.md) and its commit map. Start a fresh API session. Keep one browser window at 1512px wide and one terminal for tests. Use a second checkout when showing earlier checkpoints, so the demonstration app stays available.

Open the [definition contract](../chapters/01-definition-contract.md), pure evaluator, service, route and results component before recording. Label every sample as synthetic.

## Scene sequence

| Approximate time | Visible action                                                                 | Explanation to give                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 00:00–02:00      | Create the sample portfolio; evaluate Concentrated                             | “This holding is 60%. Our mandate allows 40%. Show me the exact reason.”                                                 |
| 02:00–05:00      | Open contracts and synthetic fixtures                                          | Translate 40% to 0.4, distinguish portfolio, mandate and candidate, explain the one-basis-point grid.                    |
| 05:00–07:00      | Replay task 2 and draw the request path                                        | React presents a decision; API validates the wire contract; core owns the rule.                                          |
| 07:00–12:00      | Walk through task 3's pure evaluator and tests                                 | Add integer weights, compare inclusive limits, distinguish invalid allocation from a policy breach and missing evidence. |
| 12:00–16:00      | Walk through use cases, memory adapter and task 4 routes                       | Capture a revision, retry a command, inspect the audit event. A process session is not durable storage.                  |
| 16:00–21:00      | Walk through the task 5 components and connected form                          | Show percentage conversion, pending state, request error, candidate editing and server result rendering.                 |
| 21:00–27:00      | Run Balanced, Low cash, 110% total, Missing sector and conflicting cash bounds | Ask the viewer to predict each outcome before revealing it. Explain known breach plus unknown data.                      |
| 27:00–30:00      | Show revision conflict test, browser tests and provenance                      | A green HTTP response alone does not mean the allocation passed. Tests pin financial boundaries and state transitions.   |
| 30:00–32:00      | Restart API and reload the browser session                                     | Show exactly what disappears, then explain Chapter 2's instrument-identity boundary.                                     |

## Independent examples to narrate

- Balanced: 40% + 30% + 20% + 10% cash = 100%. Position and cash boundaries are inclusive.
- Concentrated: 60% + 20% + 10% + 10% cash = 100%. Valid total; position and technology-sector limits are breached.
- Low cash: 40% + 30% + 25% + 5% cash = 100%. Allocation structure is valid; the 10% cash floor is breached.
- Invalid total: 40% + 30% + 20% + 20% cash = 110%. Fix structure before making a policy claim.
- Missing sector: the 40% Aurora exposure is unclassified. No sector compliance claim can cover that missing classification.
- Conflicting mandate: minimum cash 35%, maximum cash 30%. No cash value satisfies both.

## Questions for the learner

1. Why is a total of 110% different from one position exceeding its cap?
2. Why must an unknown sector remain visible when a known position already breaches a limit?
3. Which parts of the same candidate become stale after a mandate edit?
4. Why does a successful retry not create a second portfolio?
5. What information must be added before the synthetic IDs can be trusted as real instruments?

## Recording evidence and handoff

Use the generated desktop/mobile screenshots for layout reference. Record the actual connected browser and show the request's policy revision and timestamps. Do not present preset inputs as market observations, treat a classified ETF as underlying-asset look-through, or describe memory storage as durable.

End with: “We can explain a candidate against a saved mandate. Next, we need to prove what each instrument actually is.”

Chapter 2 starts only after the maintainer requests it.
