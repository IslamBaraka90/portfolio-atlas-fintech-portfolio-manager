import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  instrumentSchema,
  ingestionResultSchema,
  marketDatasetSchema,
  type Instrument,
  type MarketDataset,
} from "@portfolio-atlas/contracts";
import { read, write } from "../../shared/api";
import { LearningShell } from "../../app/LearningShell";
import { CandleChart } from "./CandleChart";
import "./data-quality.css";
export function DataQualityDesk() {
  const [instruments, setInstruments] = useState<Instrument[]>([]),
    [instrumentId, setInstrumentId] = useState("");
  const [from, setFrom] = useState("2026-09-01"),
    [to, setTo] = useState("2026-09-18");
  const [scenario, setScenario] = useState("adversarial"),
    [datasets, setDatasets] = useState<MarketDataset[]>([]);
  const [dataset, setDataset] = useState<MarketDataset | null>(null),
    [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("Choose a saved instrument from Chapter 2.");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/instruments", z.array(instrumentSchema), abort.signal),
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
    ])
      .then(([a, b]) => {
        setInstruments(a.data);
        setInstrumentId(a.data[0]?.instrumentId ?? "");
        setDatasets(b.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function ingest() {
    const instrument = instruments.find((row) => row.instrumentId === instrumentId);
    if (!instrument) return;
    setBusy(true);
    setError("");
    setDataset(null);
    try {
      const result = await write(
        "POST",
        "/market-data/ingestions",
        { instrumentId, instrumentRevision: instrument.revision, from, to, scenario },
        ingestionResultSchema,
      );
      if (result.data.dataset) {
        setDataset(result.data.dataset);
        setFilter("all");
        setDatasets((items) => [
          ...items.filter((row) => row.id !== result.data.dataset!.id),
          result.data.dataset!,
        ]);
        setNotice("Evidence archived. Every source row remains available for inspection.");
      } else setNotice(result.data.failure?.message ?? "No dataset was created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const codes = [
    ...new Set(dataset?.quality.rows.flatMap((row) => row.findings.map((f) => f.code)) ?? []),
  ].sort();
  return (
    <LearningShell active={3}>
      <div className="chapter-page">
        <div className="eyebrow">CHAPTER 03 / MARKET DATA</div>
        <h1>
          A chart is only as good
          <br />
          as its candles.
        </h1>
        <p className="chapter-intro">
          Inspect the evidence before a price enters a calculation. Rejected rows keep their place
          and their explanation.
        </p>
        {error && (
          <div className="error-banner" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}
        <div role="status" className="chapter-notice">
          {notice}
        </div>
        <section className="chapter-panel" aria-labelledby="ingest-title">
          <h2 id="ingest-title">01 / Retrieve a daily window</h2>
          {!instruments.length ? (
            <p>
              <a href="#instruments">Resolve an instrument in Chapter 2 first.</a>
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void ingest();
              }}
              className="chapter-form"
            >
              <label>
                Saved instrument
                <select
                  value={instrumentId}
                  onChange={(e) => setInstrumentId(e.target.value)}
                  disabled={busy}
                >
                  {instruments.map((row) => (
                    <option key={row.instrumentId} value={row.instrumentId}>
                      {row.returnedSymbol} · {row.source} · revision {row.revision}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From (UTC)
                <input
                  type="date"
                  value={from}
                  required
                  onChange={(e) => setFrom(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                To (exclusive UTC)
                <input
                  type="date"
                  value={to}
                  required
                  onChange={(e) => setTo(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label>
                Synthetic fixture
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  disabled={busy}
                >
                  <option value="adversarial">Break the candles</option>
                  <option value="clean">Clean daily series</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Retrieving evidence…" : "Ingest daily candles"}
              </button>
            </form>
          )}
          <p className="chapter-muted">
            Fixture selection applies to synthetic instruments. Yahoo requires server opt-in and
            preserves unknown identity, tick and finality evidence.
          </p>
          {datasets.length > 0 && (
            <label>
              Saved dataset
              <select
                aria-label="Saved dataset"
                value={dataset?.id ?? ""}
                onChange={(e) => {
                  setDataset(datasets.find((row) => row.id === e.target.value) ?? null);
                  setFilter("all");
                }}
              >
                <option value="">Choose evidence</option>
                {datasets.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.instrument.returnedSymbol} · {row.request.scenario} · revision{" "}
                    {row.revision}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>
        {dataset && (
          <>
            <section className="chapter-panel" aria-labelledby="quality-title">
              <h2 id="quality-title">02 / What can the calculations trust?</h2>
              <div className="chapter-metrics">
                <div>
                  <strong>{dataset.rows.length}</strong>
                  <span>Source rows retained</span>
                </div>
                <div>
                  <strong>{dataset.quality.acceptedIndexes.length}</strong>
                  <span>Accepted for price analytics</span>
                </div>
                <div>
                  <strong>{dataset.quality.quarantinedIndexes.length}</strong>
                  <span>Quarantined</span>
                </div>
                <div>
                  <strong>{dataset.quality.coverage.expectedSessions ?? "Unknown"}</strong>
                  <span>Expected sessions</span>
                </div>
              </div>
              <CandleChart dataset={dataset} />
              <p>
                Coverage: {dataset.quality.coverage.observedSessions} observed session labels;{" "}
                {dataset.quality.coverage.missingSessions.length} known missing sessions.
              </p>
              {dataset.quality.coverage.missingSessions.map((row) => (
                <p key={row.sessionDate} className="chapter-warning">
                  {row.sessionDate}: {row.classification} — {row.reason}
                </p>
              ))}
              <label>
                Filter row reason
                <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All source rows</option>
                  <option value="quarantined">Quarantined rows</option>
                  {codes.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <div
                className="chapter-table-wrap"
                tabIndex={0}
                aria-label="Scrollable candle evidence"
              >
                <table>
                  <caption>
                    Source observations in their original order; prices are in reported quote units.
                  </caption>
                  <thead>
                    <tr>
                      <th>Source row / session</th>
                      <th>O / H / L / C</th>
                      <th>Volume</th>
                      <th>Finality</th>
                      <th>Decision and reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows
                      .map((row, index) => ({ row, quality: dataset.quality.rows[index]! }))
                      .filter(
                        ({ quality }) =>
                          filter === "all" ||
                          (filter === "quarantined"
                            ? !quality.accepted
                            : quality.findings.some((f) => f.code === filter)),
                      )
                      .map(({ row, quality }) => (
                        <tr key={row.rowId}>
                          <td>
                            {row.sourceIndex}
                            <br />
                            {row.sessionDate ?? "Unknown date"}
                            <small>{row.timestamp ?? "Unknown timestamp"}</small>
                          </td>
                          <td>
                            {[row.open, row.high, row.low, row.close]
                              .map((v) => v ?? "Missing")
                              .join(" / ")}
                            <small>Adj. close: {row.adjustedClose ?? "Not supplied"}</small>
                          </td>
                          <td>{row.volume ?? "Missing"}</td>
                          <td>{row.finality}</td>
                          <td>
                            <strong className={quality.accepted ? "quality-pass" : "quality-fail"}>
                              {quality.accepted ? "Accepted" : "Quarantined"}
                            </strong>
                            {quality.findings.map((f, index) => (
                              <small key={f.code + index}>
                                {f.code}: {f.reason}
                              </small>
                            ))}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="chapter-panel provenance-panel">
              <h2>03 / Follow the evidence</h2>
              <dl className="chapter-provenance">
                <div>
                  <dt>Dataset</dt>
                  <dd>
                    {dataset.id} · revision {dataset.revision}
                  </dd>
                </div>
                <div>
                  <dt>Source / basis</dt>
                  <dd>
                    {dataset.source} / {dataset.basis}
                  </dd>
                </div>
                <div>
                  <dt>Observed at</dt>
                  <dd>
                    {dataset.observedAt} · {dataset.cache}
                  </dd>
                </div>
                <div>
                  <dt>Units / timezone</dt>
                  <dd>
                    {dataset.quoteUnit.reported ?? "Unknown"} →{" "}
                    {dataset.quoteUnit.currency ?? "Unknown"} ×{" "}
                    {dataset.quoteUnit.scaleToCurrency ?? "Unknown"} /{" "}
                    {dataset.timezone ?? "Unknown"}
                  </dd>
                </div>
                <div>
                  <dt>Source SHA-256</dt>
                  <dd>{dataset.sourceHash}</dd>
                </div>
                <div>
                  <dt>Archive / policy</dt>
                  <dd>
                    {dataset.archiveRef} / {dataset.quality.policyVersion}
                  </dd>
                </div>
              </dl>
              {dataset.quality.warnings.map((warning) => (
                <p key={warning} className="chapter-muted">
                  {warning}
                </p>
              ))}
              <p className="chapter-muted">
                Memory dataset storage resets with the API. Source JSON stays in the server's local
                ignored archive. Historical availability and corporate-action comparability are not
                established here.
              </p>
            </section>
          </>
        )}
      </div>
    </LearningShell>
  );
}
