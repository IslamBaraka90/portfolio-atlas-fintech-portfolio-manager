import type {
  AttributionRequest,
  AttributionResult,
  PerformanceSnapshot,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D } from "../accounting/decimal.js";
export function brinsonFachler(
  request: AttributionRequest,
  performance: PerformanceSnapshot | null,
) {
  const portfolio = request.sectors.reduce(
      (sum, s) => sum.plus(new D(s.portfolioWeight).times(s.portfolioReturn)),
      new D(0),
    ),
    benchmark = request.sectors.reduce(
      (sum, s) => sum.plus(new D(s.benchmarkWeight).times(s.benchmarkReturn)),
      new D(0),
    );
  const effects = request.sectors.map((s) => {
    const weightDifference = new D(s.portfolioWeight).minus(s.benchmarkWeight),
      returnDifference = new D(s.portfolioReturn).minus(s.benchmarkReturn),
      allocation = weightDifference.times(new D(s.benchmarkReturn).minus(benchmark)),
      selection = new D(s.benchmarkWeight).times(returnDifference),
      interaction = weightDifference.times(returnDifference);
    return {
      sector: s.sector,
      allocation: allocation.toNumber(),
      selection: selection.toNumber(),
      interaction: interaction.toNumber(),
      total: allocation.plus(selection).plus(interaction).toNumber(),
    };
  });
  const sum = (key: "allocation" | "selection" | "interaction") =>
    effects.reduce((s, e) => s.plus(e[key]), new D(0));
  const allocation = sum("allocation"),
    selection = sum("selection"),
    interaction = sum("interaction"),
    active = portfolio.minus(benchmark),
    residual = active.minus(allocation).minus(selection).minus(interaction);
  const linkageReasons: string[] = [];
  if (performance) {
    if (performance.currency !== request.currency)
      linkageReasons.push("Currency differs from the linked performance.");
    if (
      performance.valuations[0]!.request.asOf.slice(0, 10) !== request.from ||
      performance.valuations.at(-1)!.request.asOf.slice(0, 10) !== request.to
    )
      linkageReasons.push("Period dates differ from the linked performance.");
    if (performance.twr.value === null || portfolio.minus(performance.twr.value).abs().gt(1e-10))
      linkageReasons.push("Authored sector return does not equal linked net TWR.");
  }
  const linkage: AttributionResult["linkage"] = !performance
    ? "standalone_example"
    : linkageReasons.length
      ? "incompatible"
      : "compatible";
  return {
    portfolioReturn: portfolio.toNumber(),
    benchmarkReturn: benchmark.toNumber(),
    activeReturn: active.toNumber(),
    effects,
    allocation: allocation.toNumber(),
    selection: selection.toNumber(),
    interaction: interaction.toNumber(),
    residual: residual.toNumber(),
    reconciled: residual.abs().lte(1e-10),
    linkage,
    linkageReasons,
    warnings: [
      "Authored one-period sector example with beginning weights; not inferred from account holdings.",
      "Three-effect Brinson-Fachler arithmetic; interaction is separate from selection.",
      "A compatible link checks supplied aggregate, dates and currency; it does not verify sector source data.",
      "Sector returns must share the declared net-performance fee basis when linked. No multi-period, factor or currency attribution is claimed.",
    ],
  };
}
