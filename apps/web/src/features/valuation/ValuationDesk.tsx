import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  portfolioSchema,
  bookStateSchema,
  marketDatasetSchema,
  adjustmentResultSchema,
  valuationSnapshotSchema,
  actionReviewSchema,
  type Portfolio,
  type BookState,
  type MarketDataset,
  type AdjustmentResult,
  type ValuationSnapshot,
  type ValuationRequest,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { BenchmarkDesk } from "./BenchmarkDesk";
import "../data-quality/data-quality.css";
import "./valuation.css";
interface Choice {
  datasetId: string;
  rowId: string;
  overridePrice: string;
  overrideReason: string;
  overrideTime: string;
}
export function ValuationDesk() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]),
    [portfolioId, setPortfolioId] = useState(""),
    [book, setBook] = useState<BookState | null>(null);
  const [datasets, setDatasets] = useState<MarketDataset[]>([]),
    [runs, setRuns] = useState<AdjustmentResult[]>([]),
    [snapshots, setSnapshots] = useState<ValuationSnapshot[]>([]);
  const [valuation, setValuation] = useState<ValuationSnapshot | null>(null),
    [choices, setChoices] = useState<Record<string, Choice>>({}),
    [fxId, setFxId] = useState(""),
    [ageDays, setAgeDays] = useState("10");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/portfolios", z.array(portfolioSchema), abort.signal),
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
      read("/adjustment-runs", z.array(adjustmentResultSchema), abort.signal),
      read("/valuations", z.array(valuationSnapshotSchema), abort.signal),
    ])
      .then(([p, d, r, v]) => {
        setPortfolios(p.data);
        setPortfolioId(p.data[0]?.id ?? "");
        setDatasets(d.data);
        setRuns(r.data);
        setSnapshots(v.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    setBook(null);
    setValuation(null);
    setChoices({});
    if (!portfolioId) return;
    const abort = new AbortController();
    read("/portfolios/" + encodeURIComponent(portfolioId) + "/book", bookStateSchema, abort.signal)
      .then((r) => setBook(r.data))
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, [portfolioId]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function initialChoice(id: string): Choice {
    const d =
      datasets.find((d) => d.instrument.instrumentId === id && d.request.scenario === "clean") ??
      datasets.find((d) => d.instrument.instrumentId === id);
    return {
      datasetId: d?.id ?? "",
      rowId: d?.rows[d.quality.acceptedIndexes.at(-1) ?? -1]?.rowId ?? "",
      overridePrice: "",
      overrideReason: "",
      overrideTime: "",
    };
  }
  const choiceFor = (id: string) => choices[id] ?? initialChoice(id);
  function change(id: string, value: Partial<Choice>) {
    setChoices((c) => ({ ...c, [id]: { ...choiceFor(id), ...value } }));
  }
  function freeze() {
    void perform(async () => {
      if (!book) return;
      const prices: ValuationRequest["prices"] = [],
        overrides: ValuationRequest["overrides"] = [];
      for (const position of book.book.positions) {
        const choice = choiceFor(position.instrumentId),
          dataset = datasets.find((d) => d.id === choice.datasetId);
        if (dataset && choice.rowId) {
          const review = await write(
            "POST",
            "/corporate-actions/reviews",
            { datasetId: dataset.id, datasetRevision: dataset.revision },
            actionReviewSchema,
          );
          prices.push({
            instrumentId: position.instrumentId,
            dataset: { id: dataset.id, revision: dataset.revision },
            rowId: choice.rowId,
            reviewId: review.data.id,
          });
        }
        if (choice.overridePrice)
          overrides.push({
            instrumentId: position.instrumentId,
            currency: position.currency,
            price: choice.overridePrice,
            quotedAt: choice.overrideTime || new Date().toISOString(),
            sourceRef: "manual-teaching-mark",
            reason: choice.overrideReason,
          });
      }
      const fx = runs.find((r) => r.id === fxId);
      const result = await write(
        "POST",
        "/valuations",
        {
          portfolioId,
          checkpoint: book.book.checkpoint,
          asOf: new Date().toISOString(),
          maxPriceAgeSeconds: Number(ageDays) * 86400,
          prices,
          overrides,
          fxRuns: fx ? [{ id: fx.id, revision: fx.revision }] : [],
        },
        valuationSnapshotSchema,
      );
      setValuation(result.data);
      setSnapshots((rows) => [...rows.filter((v) => v.id !== result.data.id), result.data]);
    });
  }
  function refreshBook() {
    void perform(async () => {
      if (portfolioId)
        setBook(
          (await read("/portfolios/" + encodeURIComponent(portfolioId) + "/book", bookStateSchema))
            .data,
        );
    });
  }
  return (
    <LearningShell active={6}>
      <div className="chapter-page">
        <div className="eyebrow">CHAPTER 06 / VALUE + COMPARISON</div>
        <h1>
          A total you
          <br />
          can explain.
        </h1>
        <p className="chapter-intro">
          Freeze the book, choose evidenced prices, and follow cash and holdings into NAV. Keep each
          benchmark's currency and dividend convention visible.
        </p>
        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="error-banner">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>01 / Freeze the inputs</h2>
          <p className="chapter-muted">
            Post the book in <a href="#book">Portfolio book</a> and ingest its clean teaching
            history in <a href="#market-data">Candle quality</a>. A missing source remains
            unavailable.
          </p>
          <div className="chapter-form">
            <label>
              Valuation portfolio
              <select
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                disabled={busy}
              >
                <option value="">Choose a portfolio</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Maximum price age (calendar days)
              <input
                type="number"
                min="1"
                max="30"
                value={ageDays}
                onChange={(e) => setAgeDays(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              FX evidence
              <select value={fxId} onChange={(e) => setFxId(e.target.value)} disabled={busy}>
                <option value="">No FX observation</option>
                {runs
                  .filter((r) => r.fx !== null)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fx!.baseCurrency}/{r.fx!.quoteCurrency} · {r.fx!.quotePerBase} · revision{" "}
                      {r.revision}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {book && (
            <p className="chapter-notice">
              Book checkpoint {book.book.checkpoint} · {book.book.positions.length} holdings ·{" "}
              {book.book.reconciled ? "reconciled" : "requires review"} · as of the next freeze
              request
            </p>
          )}
          <button className="secondary" onClick={refreshBook} disabled={busy || !portfolioId}>
            Refresh book checkpoint
          </button>
          {book?.book.positions.map((position) => {
            const choice = choiceFor(position.instrumentId),
              dataset = datasets.find((d) => d.id === choice.datasetId);
            return (
              <fieldset
                key={position.instrumentId}
                disabled={busy}
                className="valuation-fields valuation-position"
              >
                <legend>
                  {position.instrumentId} · {position.quantity} shares · {position.currency}
                </legend>
                <div className="chapter-form">
                  <label>
                    Price dataset for {position.instrumentId}
                    <select
                      value={choice.datasetId}
                      onChange={(e) => {
                        const d = datasets.find((r) => r.id === e.target.value);
                        change(position.instrumentId, {
                          datasetId: e.target.value,
                          rowId: d?.rows[d.quality.acceptedIndexes.at(-1) ?? -1]?.rowId ?? "",
                        });
                      }}
                    >
                      <option value="">Missing price source</option>
                      {datasets
                        .filter((d) => d.instrument.instrumentId === position.instrumentId)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.instrument.returnedSymbol} · {d.request.scenario} · revision{" "}
                            {d.revision}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Price row for {position.instrumentId}
                    <select
                      value={choice.rowId}
                      onChange={(e) => change(position.instrumentId, { rowId: e.target.value })}
                    >
                      <option value="">No row selected</option>
                      {dataset?.rows.map((r, i) => (
                        <option key={r.rowId} value={r.rowId}>
                          {r.sessionDate ?? "Unknown date"} · {r.close ?? "missing"} ·{" "}
                          {dataset.quality.acceptedIndexes.includes(i) ? "accepted" : "quarantined"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <details>
                  <summary>Explicit teaching override</summary>
                  <p className="chapter-muted">
                    An override asserts a price in the current book share units and takes precedence
                    over the selected row. Its reason and recorded time remain visible.
                  </p>
                  <div className="chapter-form">
                    <label>
                      Override price for {position.instrumentId}
                      <input
                        inputMode="decimal"
                        value={choice.overridePrice}
                        onChange={(e) =>
                          change(position.instrumentId, { overridePrice: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Override quote time for {position.instrumentId}
                      <input
                        placeholder="Blank = time entered"
                        value={choice.overrideTime}
                        onChange={(e) =>
                          change(position.instrumentId, { overrideTime: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Override reason for {position.instrumentId}
                      <input
                        value={choice.overrideReason}
                        onChange={(e) =>
                          change(position.instrumentId, { overrideReason: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </details>
              </fieldset>
            );
          })}
          <button
            className="primary"
            onClick={freeze}
            disabled={busy || !book || !book.book.reconciled}
          >
            {busy ? "Working…" : "Freeze valuation"}
          </button>
        </section>
        <section className="chapter-panel">
          <h2>02 / Read the NAV bridge</h2>
          <label>
            Saved valuation
            <select
              value={valuation?.id ?? ""}
              onChange={(e) => setValuation(snapshots.find((v) => v.id === e.target.value) ?? null)}
              disabled={busy}
            >
              <option value="">Choose a frozen valuation</option>
              {snapshots
                .filter((v) => v.request.portfolioId === portfolioId)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    Checkpoint {v.book.checkpoint} · {v.status} · {v.createdAt}
                  </option>
                ))}
            </select>
          </label>
          {!valuation && (
            <p className="chapter-muted">
              Freeze inputs to explain the total. No illustrative value is substituted for an
              unavailable result.
            </p>
          )}
          {valuation && (
            <>
              <h3>Valuation: {valuation.status}</h3>
              <p className="chapter-muted">
                {valuation.baseCurrency} · journal checkpoint {valuation.book.checkpoint} ·
                knowledge cutoff {valuation.request.asOf}
              </p>
              <div className="chapter-metrics">
                <div>
                  <span>CASH</span>
                  <strong>{valuation.totals.cashBase ?? "Incomplete"}</strong>
                </div>
                <div>
                  <span>+ HOLDINGS</span>
                  <strong>{valuation.totals.holdingsBase ?? "Incomplete"}</strong>
                </div>
                <div>
                  <span>= NET ASSET VALUE</span>
                  <strong data-testid="nav-value">{valuation.totals.nav ?? "Incomplete"}</strong>
                </div>
                <div>
                  <span>PRICED HOLDINGS</span>
                  <strong>
                    {valuation.coverage.valuedHoldings}/{valuation.coverage.totalHoldings}
                  </strong>
                </div>
              </div>
              <div className="chapter-table-wrap" tabIndex={0} aria-label="Valued holdings">
                <table>
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Shares</th>
                      <th>Mark / state</th>
                      <th>Local value</th>
                      <th>Base value</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuation.positions.map((p) => (
                      <tr key={p.instrumentId}>
                        <th>{p.instrumentId}</th>
                        <td>{p.quantity}</td>
                        <td>
                          {p.mark.price ?? "Unavailable"} {p.currency}
                          <br />
                          {p.mark.status}
                        </td>
                        <td>{p.marketValueLocal ?? "Unavailable"}</td>
                        <td>{p.marketValueBase ?? "Unavailable"}</td>
                        <td>
                          {p.reasons.join(" ") || "Accepted evidence in current book units."}
                          {p.mark.override && <p>Override: {p.mark.override.reason}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chapter-table-wrap" tabIndex={0} aria-label="Valued cash">
                <table>
                  <thead>
                    <tr>
                      <th>Cash currency</th>
                      <th>Settled amount</th>
                      <th>Base value</th>
                      <th>FX evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {valuation.cash.map((c) => (
                      <tr key={c.currency}>
                        <th>{c.currency}</th>
                        <td>{c.amount}</td>
                        <td>{c.baseAmount ?? "Unavailable"}</td>
                        <td>{c.reasons.join(" ") || c.fxId || "Same currency"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>External capital is a separate movement</h3>
              {valuation.externalCapital.map((c) => (
                <p key={c.currency}>
                  {c.currency} net contributions: <strong>{c.netContributed}</strong>
                </p>
              ))}
              {valuation.warnings.map((w) => (
                <p className="chapter-muted" key={w}>
                  {w}
                </p>
              ))}
            </>
          )}
        </section>
        {valuation && (
          <section className="chapter-panel">
            <h2>03 / Inspect the frozen evidence</h2>
            <p className="chapter-muted">
              Snapshot {valuation.id} · policy {valuation.policyVersion}. Later book or dataset
              revisions cannot silently change these references.
            </p>
            {valuation.positions.map((p) => (
              <div key={p.instrumentId} className="valuation-source">
                <strong>{p.instrumentId}</strong>
                <p>
                  Quoted {p.mark.quotedAt ?? "unavailable"} · observed{" "}
                  {p.mark.observedAt ?? "unavailable"}
                </p>
                {p.mark.dataset && (
                  <a
                    href={
                      "#market-data?dataset=" +
                      encodeURIComponent(p.mark.dataset.id) +
                      "&revision=" +
                      p.mark.dataset.revision
                    }
                  >
                    Price evidence · revision {p.mark.dataset.revision}
                  </a>
                )}
                <p className="chapter-muted">
                  Source hash: {p.mark.sourceHash ?? "Manual evidence only"}
                </p>
              </div>
            ))}
          </section>
        )}
        <BenchmarkDesk
          runs={runs}
          datasets={datasets}
          busy={busy}
          perform={perform}
          onError={setError}
        />
      </div>
    </LearningShell>
  );
}
