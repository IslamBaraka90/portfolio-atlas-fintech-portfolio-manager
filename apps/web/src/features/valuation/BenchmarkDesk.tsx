import { useEffect, useState } from "react";
import { z } from "zod";
import {
  benchmarkDefinitionSchema,
  benchmarkResultSchema,
  benchmarkComparisonSchema,
  type AdjustmentResult,
  type BenchmarkResult,
  type MarketDataset,
} from "@portfolio-atlas/contracts";
import { read, write } from "../../shared/api";
type Basis = "price" | "gross_total_return";
export function BenchmarkDesk({
  runs,
  datasets,
  busy,
  perform,
  onError,
}: {
  runs: AdjustmentResult[];
  datasets: MarketDataset[];
  busy: boolean;
  perform: (action: () => Promise<void>) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("Atlas equal-weight baseline"),
    [basis, setBasis] = useState<Basis>("price"),
    [currency, setCurrency] = useState("USD");
  const [selected, setSelected] = useState<string[]>([]),
    [results, setResults] = useState<BenchmarkResult[]>([]),
    [result, setResult] = useState<BenchmarkResult | null>(null);
  const [requestedBasis, setRequestedBasis] = useState<Basis>("gross_total_return"),
    [comparison, setComparison] = useState<z.infer<typeof benchmarkComparisonSchema> | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    read("/benchmarks", z.array(benchmarkResultSchema), abort.signal)
      .then((r) => setResults(r.data))
      .catch((e) => {
        if (!abort.signal.aborted) onError(String(e));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    setComparison(null);
    if (!result) return;
    const abort = new AbortController();
    read(
      "/benchmarks/" + result.id + "/comparison?basis=" + requestedBasis + "&currency=" + currency,
      benchmarkComparisonSchema,
      abort.signal,
    )
      .then((r) => setComparison(r.data))
      .catch((e) => {
        if (!abort.signal.aborted) onError(String(e));
      });
    return () => abort.abort();
  }, [result, requestedBasis, currency]);
  function calculate() {
    void perform(async () => {
      const definition = await write(
        "POST",
        "/benchmark-definitions",
        {
          name,
          currency,
          returnBasis: basis,
          adjustmentRuns: selected.map((id) => ({
            id,
            revision: runs.find((r) => r.id === id)!.revision,
          })),
        },
        benchmarkDefinitionSchema,
      );
      const value = await write(
        "POST",
        "/benchmarks",
        { definitionId: definition.data.id },
        benchmarkResultSchema,
      );
      setResult(value.data);
      setResults((rows) => [...rows.filter((r) => r.id !== value.data.id), value.data]);
    });
  }
  const levels = result?.series.map((r) => r.level) ?? [],
    low = Math.min(...levels),
    span = Math.max(1, Math.max(...levels) - low);
  return (
    <section className="chapter-panel">
      <h2>04 / Define an honest benchmark</h2>
      <p className="chapter-muted">
        Use saved research views from <a href="#actions">Actions & currency</a>. Equal weight
        applies at the first session, then weights drift. This authored baseline has no daily reset,
        fees, cash allocation or tax withholding.
      </p>
      <fieldset disabled={busy} className="valuation-fields">
        <div className="chapter-form">
          <label>
            Benchmark name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Benchmark return basis
            <select value={basis} onChange={(e) => setBasis(e.target.value as Basis)}>
              <option value="price">Price only</option>
              <option value="gross_total_return">Gross total return</option>
            </select>
          </label>
          <label>
            Comparison currency
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "EUR", "GBP", "EGP", "SAR"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Benchmark constituent histories
          <select
            multiple
            size={Math.max(2, Math.min(5, runs.length))}
            value={selected}
            onChange={(e) => setSelected(Array.from(e.target.selectedOptions, (o) => o.value))}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {datasets.find((d) => d.id === r.datasetId)?.instrument.returnedSymbol ??
                  r.datasetId}{" "}
                · revision {r.revision} · {r.status} · {r.sourceCurrency}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          onClick={calculate}
          disabled={selected.length === 0 || name.trim().length < 3}
        >
          Freeze benchmark and calculate
        </button>
      </fieldset>
      {results.length > 0 && (
        <label>
          Saved benchmark
          <select
            value={result?.id ?? ""}
            onChange={(e) => setResult(results.find((r) => r.id === e.target.value) ?? null)}
          >
            <option value="">Choose a result</option>
            {results.map((r) => (
              <option key={r.id} value={r.id}>
                {r.definition.input.name} · {r.definition.input.returnBasis} · {r.createdAt}
              </option>
            ))}
          </select>
        </label>
      )}
      {result && (
        <>
          <h3>Benchmark: {result.status}</h3>
          <p className="chapter-muted">
            {result.definition.input.name} · {result.definition.input.currency} ·{" "}
            {result.definition.input.returnBasis} · {result.definition.rebalance}
          </p>
          {result.reasons.map((r) => (
            <p className="chapter-warning" key={r}>
              {r}
            </p>
          ))}
          {result.status === "ready" && (
            <>
              <div className="chapter-metrics">
                <div>
                  <span>START LEVEL</span>
                  <strong>{result.series[0]?.level.toFixed(2)}</strong>
                </div>
                <div>
                  <span>END LEVEL</span>
                  <strong>{result.series.at(-1)?.level.toFixed(2)}</strong>
                </div>
                <div>
                  <span>PERIOD RETURN</span>
                  <strong>{(result.totalReturn! * 100).toFixed(4)}%</strong>
                </div>
                <div>
                  <span>CONSTITUENTS</span>
                  <strong>{result.constituents.length}</strong>
                </div>
              </div>
              <svg
                className="benchmark-chart"
                viewBox="0 0 720 180"
                role="img"
                aria-label="Frozen benchmark level history"
              >
                <line x1="20" x2="700" y1="155" y2="155" className="chart-grid" />
                <polyline
                  fill="none"
                  className="chart-series"
                  strokeWidth="3"
                  points={result.series
                    .map(
                      (r, i) =>
                        20 +
                        (i / Math.max(1, result.series.length - 1)) * 680 +
                        "," +
                        (150 - ((r.level - low) / span) * 125),
                    )
                    .join(" ")}
                />
                <text x="20" y="178">
                  {result.series[0]?.date}
                </text>
                <text x="700" y="178" textAnchor="end">
                  {result.series.at(-1)?.date}
                </text>
              </svg>
              <label>
                Requested portfolio return convention
                <select
                  value={requestedBasis}
                  onChange={(e) => setRequestedBasis(e.target.value as Basis)}
                >
                  <option value="price">Price only</option>
                  <option value="gross_total_return">Gross total return</option>
                </select>
              </label>
              {comparison && (
                <div
                  className={
                    comparison.status === "compatible" ? "chapter-notice" : "chapter-warning"
                  }
                  role="status"
                >
                  <strong>Comparison: {comparison.status}</strong>
                  {comparison.reasons.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
              )}
              <p className="chapter-muted">
                A compatible convention permits later comparison. It does not turn the NAV bridge
                into a flow-adjusted performance result.
              </p>
              <div
                className="chapter-table-wrap"
                tabIndex={0}
                aria-label="Benchmark constituent lineage"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Initial weight</th>
                      <th>Source dataset</th>
                      <th>Research revision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.constituents.map((c) => (
                      <tr key={c.instrumentId}>
                        <td>{c.instrumentId}</td>
                        <td>{(c.initialWeight * 100).toFixed(4)}%</td>
                        <td>
                          <a
                            href={
                              "#market-data?dataset=" +
                              encodeURIComponent(c.dataset.id) +
                              "&revision=" +
                              c.dataset.revision
                            }
                          >
                            {c.dataset.id} · revision {c.dataset.revision}
                          </a>
                        </td>
                        <td>{c.adjustmentRun.revision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {result.warnings.map((w) => (
            <p className="chapter-muted" key={w}>
              {w}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
