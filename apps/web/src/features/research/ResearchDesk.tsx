import { useEffect, useState } from "react";
import { z } from "zod";
import {
  marketDatasetSchema,
  adjustmentResultSchema,
  companyObservationSchema,
  companyIngestionSchema,
  researchResultSchema,
  type MarketDataset,
  type AdjustmentResult,
  type CompanyObservation,
  type ResearchResult,
  type CompanyRequest,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../data-quality/data-quality.css";
import "../valuation/valuation.css";
import "./research.css";
const refKey = (r: { id: string; revision: number }) => r.id + ":" + r.revision;
export function ResearchDesk() {
  const [datasets, setDatasets] = useState<MarketDataset[]>([]),
    [runs, setRuns] = useState<AdjustmentResult[]>([]),
    [companies, setCompanies] = useState<CompanyObservation[]>([]),
    [results, setResults] = useState<ResearchResult[]>([]);
  const [selected, setSelected] = useState<string[]>([]),
    [adjusted, setAdjusted] = useState<Record<string, string>>({}),
    [companyRefs, setCompanyRefs] = useState<Record<string, string>>({});
  const [loader, setLoader] = useState(""),
    [scenario, setScenario] = useState<CompanyRequest["scenario"]>("standard"),
    [frequency, setFrequency] = useState<CompanyRequest["frequency"]>("annual"),
    [from, setFrom] = useState("2023-01-01"),
    [to, setTo] = useState("2026-09-22"),
    [asOf, setAsOf] = useState(new Date().toISOString()),
    [windowSize, setWindowSize] = useState("3"),
    [purpose, setPurpose] = useState<"current_research" | "historical_strategy">(
      "current_research",
    );
  const [result, setResult] = useState<ResearchResult | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
      read("/adjustment-runs", z.array(adjustmentResultSchema), abort.signal),
      read("/company-observations", z.array(companyObservationSchema), abort.signal),
      read("/research-runs", z.array(researchResultSchema), abort.signal),
    ])
      .then(([d, r, c, s]) => {
        setDatasets(d.data);
        setRuns(r.data);
        setCompanies(c.data);
        setResults(s.data);
        setLoader(d.data[0] ? refKey(d.data[0]) : "");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const loadCompany = () =>
    void perform(async () => {
      const dataset = datasets.find((d) => refKey(d) === loader)!;
      const value = (
        await write(
          "POST",
          "/company-observations",
          {
            instrumentId: dataset.instrument.instrumentId,
            instrumentRevision: dataset.instrument.revision,
            from,
            to,
            frequency,
            scenario,
          },
          companyIngestionSchema,
        )
      ).data;
      if (!value.observation) throw new Error(value.reasons.join(" "));
      const observation = value.observation;
      setAsOf(new Date().toISOString());
      setCompanies((rows) => [
        ...rows.filter((r) => refKey(r) !== refKey(observation)),
        observation,
      ]);
      setCompanyRefs((v) => ({ ...v, [dataset.instrument.instrumentId]: refKey(observation) }));
    });
  const calculate = () =>
    void perform(async () => {
      const chosen = datasets.filter((d) => selected.includes(refKey(d)));
      const value = (
        await write(
          "POST",
          "/research-runs",
          {
            series: chosen.map((d) => {
              const run = runs.find((r) => refKey(r) === adjusted[refKey(d)]);
              return {
                dataset: { id: d.id, revision: d.revision },
                adjustmentRun: run ? { id: run.id, revision: run.revision } : null,
              };
            }),
            companies: chosen.flatMap((d) => {
              const c = companies.find((r) => refKey(r) === companyRefs[d.instrument.instrumentId]);
              return c ? [{ id: c.id, revision: c.revision }] : [];
            }),
            asOf,
            window: Number(windowSize),
            purpose,
          },
          researchResultSchema,
        )
      ).data;
      setResult(value);
      setResults((rows) => [...rows.filter((r) => r.id !== value.id), value]);
    });
  return (
    <LearningShell active={7}>
      <div className="chapter-page research-page">
        <div className="chapter-heading">
          <p className="eyebrow">CHAPTER 07 / RESEARCH & EVIDENCE</p>
          <h1>
            What did we know,
            <br />
            and when?
          </h1>
          <p>
            Inspect trend, company profitability and participation with the source records that
            support each observation.
          </p>
        </div>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>01 / Capture company observations</h2>
          <p className="chapter-muted">
            Select a listing already captured in <a href="#market-data">Candle quality</a>. Yahoo
            statements are observed now. Authored statements include fictional release and revision
            times for the lesson.
          </p>
          <fieldset disabled={busy} className="valuation-fields">
            <div className="chapter-form">
              <label>
                Company listing
                <select value={loader} onChange={(e) => setLoader(e.target.value)}>
                  <option value="">Choose a captured listing</option>
                  {datasets.map((d) => (
                    <option key={refKey(d)} value={refKey(d)}>
                      {d.instrument.returnedSymbol} · {d.source} · data r{d.revision}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Statement frequency
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as CompanyRequest["frequency"])}
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>
              <label>
                Company lesson
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as CompanyRequest["scenario"])}
                >
                  <option value="standard">Standard</option>
                  <option value="missing">Missing net income</option>
                  <option value="zero-revenue">Zero revenue</option>
                  <option value="late-revision">Late revision</option>
                </select>
              </label>
              <label>
                Statement start
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label>
                Statement end (exclusive)
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
            <button className="primary" disabled={!loader} onClick={loadCompany}>
              Capture company statements
            </button>
          </fieldset>
          <p role="status">{companies.length} company observation snapshots available.</p>
        </section>
        <section className="chapter-panel">
          <h2>02 / Freeze the research inputs</h2>
          {!datasets.length && <p>Capture an instrument and its candles first.</p>}
          <fieldset disabled={busy} className="valuation-fields">
            {datasets.map((d) => (
              <div className="research-input" key={refKey(d)}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(refKey(d))}
                    onChange={(e) =>
                      setSelected((s) =>
                        e.target.checked ? [...s, refKey(d)] : s.filter((v) => v !== refKey(d)),
                      )
                    }
                  />{" "}
                  {d.instrument.returnedSymbol} · {d.request.scenario} · revision {d.revision}
                </label>
                <div className="chapter-form">
                  <label>
                    Price basis for {d.instrument.returnedSymbol}
                    <select
                      value={adjusted[refKey(d)] ?? ""}
                      onChange={(e) => setAdjusted((r) => ({ ...r, [refKey(d)]: e.target.value }))}
                    >
                      <option value="">No-action raw fixture</option>
                      {runs
                        .filter((r) => r.datasetId === d.id && r.datasetRevision === d.revision)
                        .map((r) => (
                          <option key={refKey(r)} value={refKey(r)}>
                            Split-adjusted · r{r.revision} · {r.status}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Statements for {d.instrument.returnedSymbol}
                    <select
                      value={companyRefs[d.instrument.instrumentId] ?? ""}
                      onChange={(e) =>
                        setCompanyRefs((r) => ({
                          ...r,
                          [d.instrument.instrumentId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">No statements</option>
                      {companies
                        .filter((c) => c.instrument.instrumentId === d.instrument.instrumentId)
                        .map((c) => (
                          <option key={refKey(c)} value={refKey(c)}>
                            {c.request.scenario} · {c.request.frequency} · r{c.revision} ·{" "}
                            {c.observedAt}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
            <div className="chapter-form">
              <label>
                Research cutoff (UTC)
                <input value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </label>
              <label>
                SMA window
                <input
                  type="number"
                  min="2"
                  max="252"
                  value={windowSize}
                  onChange={(e) => setWindowSize(e.target.value)}
                />
              </label>
              <label>
                Research purpose
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as typeof purpose)}
                >
                  <option value="current_research">Current research</option>
                  <option value="historical_strategy">Historical strategy evidence check</option>
                </select>
              </label>
            </div>
            <button className="primary" disabled={!selected.length} onClick={calculate}>
              Calculate research observations
            </button>
          </fieldset>
        </section>
        <section className="chapter-panel">
          <h2>03 / Read the evidence</h2>
          <label>
            Saved research run
            <select
              value={result?.id ?? ""}
              onChange={(e) => setResult(results.find((r) => r.id === e.target.value) ?? null)}
            >
              <option value="">Choose a frozen run</option>
              {results.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.createdAt} · {r.request.purpose} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          {result && (
            <div data-testid="research-result">
              <p>
                Cutoff: {result.request.asOf} · SMA window: {result.request.window} ·{" "}
                {result.request.purpose}
              </p>
              {result.trends.map((t) => (
                <article key={t.instrumentId}>
                  <h3>{t.instrumentId} / Trend</h3>
                  <p>
                    {t.status} · {t.basis} · Latest close: {t.latestRelation ?? "unavailable"} the
                    SMA
                  </p>
                  <p>
                    Evidence known: {t.knownAt}. Initial warm-up: {t.warmupSlots} slots. Missing
                    slots restart the window.
                  </p>
                  {t.reasons.map((r) => (
                    <p className="chapter-warning" key={r}>
                      {r}
                    </p>
                  ))}
                  <p>
                    <a
                      href={
                        "#market-data?dataset=" +
                        encodeURIComponent(t.dataset.id) +
                        "&revision=" +
                        t.dataset.revision
                      }
                    >
                      Inspect source candles · r{t.dataset.revision}
                    </a>
                  </p>
                  <details>
                    <summary>Trend rows and original timestamps</summary>
                    <div className="chapter-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Session</th>
                            <th>Timestamp</th>
                            <th>Close</th>
                            <th>SMA</th>
                            <th>State</th>
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((r) => (
                            <tr key={r.sourceRowId}>
                              <td>{r.sessionDate ?? "Unknown"}</td>
                              <td>{r.timestamp ?? "Unknown"}</td>
                              <td>{r.close ?? "Unavailable"}</td>
                              <td>{r.sma?.toFixed(4) ?? "—"}</td>
                              <td>{r.state}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </article>
              ))}
              {result.fundamentals.map((f) => (
                <article key={f.instrumentId}>
                  <h3>{f.instrumentId} / Company profitability</h3>
                  <p>
                    Net income / revenue:{" "}
                    <strong>
                      {f.focusPercentage === null
                        ? "Unavailable"
                        : f.focusPercentage.toFixed(2) + "%"}
                    </strong>{" "}
                    · Change:{" "}
                    {f.focusChangePercentagePoints === null
                      ? "Unavailable"
                      : f.focusChangePercentagePoints.toFixed(2) + " percentage points"}
                  </p>
                  <p>{f.interpretation}</p>
                  {f.reasons.map((r) => (
                    <p className="chapter-warning" key={r}>
                      {r}
                    </p>
                  ))}
                  <div className="chapter-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Period end</th>
                          <th>Period</th>
                          <th>Currency</th>
                          <th>Available at</th>
                          <th>Basis / revision</th>
                          <th>Revenue</th>
                          <th>Net income</th>
                        </tr>
                      </thead>
                      <tbody>
                        {f.periods.map((p) => (
                          <tr key={p.periodEnd}>
                            <td>{p.periodEnd}</td>
                            <td>{p.periodType ?? "Unknown"}</td>
                            <td>{p.currency ?? "Unknown"}</td>
                            <td>{p.availableAt}</td>
                            <td>
                              {p.availabilityBasis} / {p.revision}
                            </td>
                            <td>{p.items.revenue ?? "Missing"}</td>
                            <td>{p.items.netIncome ?? "Missing"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {f.company && (
                    <details>
                      <summary>Company source and revision</summary>
                      <p>
                        Observation {f.company.id} / r{f.company.revision}
                      </p>
                      <code>
                        {companies.find(
                          (c) => c.id === f.company!.id && c.revision === f.company!.revision,
                        )?.sourceHash ?? "Open the exact observation through the API."}
                      </code>
                    </details>
                  )}
                </article>
              ))}
              <article>
                <h3>Selected-universe participation</h3>
                <p>{result.breadth.interpretation}</p>
                <p>
                  Status: {result.breadth.status} · Session:{" "}
                  {result.breadth.sessionDate ?? "Unavailable"} · Net advances:{" "}
                  {result.breadth.netAdvances ?? "Unavailable"} · Coverage:{" "}
                  {result.breadth.coverageRatio === null
                    ? "Unknown"
                    : (result.breadth.coverageRatio * 100).toFixed(0) + "%"}
                </p>
                <p>Universe: {result.breadth.universeIds.join(", ")}</p>
                {result.breadth.reasons.map((r) => (
                  <p key={r}>{r}</p>
                ))}
              </article>
              <details>
                <summary>Method versions and limitations</summary>
                <p>
                  {result.policyVersion} · fintech-algorithms {result.packageVersion} ·
                  Shared-fixture parity
                </p>
                {result.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </details>
              <button className="secondary" disabled>
                Create recommendation
              </button>
              <p>Research observations create no orders.</p>
            </div>
          )}
        </section>
      </div>
    </LearningShell>
  );
}
