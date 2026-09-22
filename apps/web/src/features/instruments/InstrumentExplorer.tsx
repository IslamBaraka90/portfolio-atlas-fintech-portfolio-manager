import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  aliasResultSchema,
  eligibilityDecisionSchema,
  instrumentSchema,
  mandateSchema,
  resolveResultSchema,
  searchResultSchema,
  type AliasResult,
  type DataMode,
  type EligibilityDecision,
  type Instrument,
  type InstrumentSearchResult,
  type Mandate,
} from "@portfolio-atlas/contracts";
import { read, write } from "../../shared/api";
import { LearningShell } from "../../app/LearningShell";

export function InstrumentExplorer() {
  const [query, setQuery] = useState("Aurora");
  const [mode, setMode] = useState<DataMode>("synthetic");
  const [search, setSearch] = useState<InstrumentSearchResult | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [decision, setDecision] = useState<EligibilityDecision | null>(null);
  const [saved, setSaved] = useState<Instrument[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [mandateId, setMandateId] = useState("");
  const [alias, setAlias] = useState<AliasResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("Search for a security, then choose the exact listing.");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/mandates", z.array(mandateSchema), abort.signal),
      read("/instruments", z.array(instrumentSchema), abort.signal),
    ])
      .then(([policies, records]) => {
        setMandates(policies.data);
        setMandateId(policies.data[0]?.id ?? "");
        setSaved(records.data);
      })
      .catch((failure: unknown) => {
        if (!abort.signal.aborted) setError(String(failure));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request failed.");
    } finally {
      setBusy(false);
    }
  }
  async function searchCandidates() {
    await run(async () => {
      const result = await read(
        "/instruments/search?" + new URLSearchParams({ q: query, mode }),
        searchResultSchema,
      );
      setSearch(result.data);
      setInstrument(null);
      setDecision(null);
      setNotice(
        result.data.status === "unavailable"
          ? result.data.failure!.message
          : result.data.candidates.length +
              " candidates. Similar names do not prove identical securities.",
      );
    });
  }
  async function resolve(candidateId: string) {
    await run(async () => {
      const result = await write(
        "POST",
        "/instruments/resolutions",
        { candidateId },
        resolveResultSchema,
      );
      setDecision(null);
      setInstrument(result.data.instrument);
      setNotice(result.data.failure?.message ?? result.data.reasons.join(" "));
      if (result.data.instrument)
        setSaved((items) => [
          ...items.filter((item) => item.instrumentId !== result.data.instrument!.instrumentId),
          result.data.instrument!,
        ]);
    });
  }
  async function evaluate() {
    if (!instrument) return;
    const mandate = mandates.find((item) => item.id === mandateId);
    if (!mandate) return;
    await run(async () => {
      const result = await write(
        "POST",
        "/universe/evaluations",
        {
          instrumentId: instrument.instrumentId,
          instrumentRevision: instrument.revision,
          mandateId,
          mandateRevision: mandate.revision,
        },
        eligibilityDecisionSchema,
      );
      setDecision(result.data);
      setNotice(
        "Eligibility: " + result.data.status + ". This decision does not authorize an order.",
      );
    });
  }
  async function inspectAlias(symbol: string, validAt: string) {
    await run(async () => {
      const result = await read(
        "/instruments/alias-resolution?" +
          new URLSearchParams({
            symbol,
            venueMic: "XNAS",
            validAt,
            knowledgeAt: "2026-09-22T10:00:00Z",
          }),
        aliasResultSchema,
      );
      setAlias(result.data);
    });
  }
  return (
    <LearningShell active={2}>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span>CHAPTER 02</span> IDENTITY BEFORE PRICES
          </div>
          <h1>
            Know the security.
            <br />
            <em>Keep the evidence.</em>
          </h1>
          <p>
            A symbol is an alias. Resolve the listing, understand its units,
            <br className="desktop-break" /> and check what is still unknown before admitting it.
          </p>
        </div>
        <div className="hero-stamp" aria-hidden="true">
          <span>PORTFOLIO ATLAS</span>
          <strong>02</strong>
          <span>INSTRUMENT IDENTITY</span>
        </div>
      </section>
      <div className="session-strip">
        <span className="badge synthetic">
          {mode === "synthetic" ? "Synthetic data" : "Yahoo observations"}
        </span>
        <span>
          Session-only instrument records. Live metadata is an observation, not permanent identity
          proof.
        </span>
      </div>
      <p className="live-notice" role="status">
        {busy ? "Retrieving evidence…" : notice}
      </p>
      {error && (
        <div role="alert" tabIndex={-1} ref={errorRef} className="error-banner">
          <strong>Unable to complete the request.</strong>
          <p>{error}</p>
          <p>For a stale revision, reload the page and select the saved record again.</p>
        </div>
      )}
      <div className="explorer-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-number">01 / DISCOVER</span>
              <h2>Select the actual listing.</h2>
            </div>
          </div>
          <form
            className="chapter-form"
            onSubmit={(event) => {
              event.preventDefault();
              void searchCandidates();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Data source
                <select
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value as DataMode);
                    setSearch(null);
                    setInstrument(null);
                    setDecision(null);
                  }}
                >
                  <option value="synthetic">Synthetic teaching catalog</option>
                  <option value="yahoo">Yahoo Finance · explicit live request</option>
                </select>
              </label>
              <label>
                Company or symbol
                <input
                  required
                  minLength={1}
                  maxLength={80}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button className="button primary wide" type="submit">
                Search instruments <span aria-hidden="true">→</span>
              </button>
            </fieldset>
          </form>
          {search && (
            <div className="candidate-list">
              {search.status === "unavailable" ? (
                <div className="empty-results">
                  <p>
                    <strong>Provider unavailable · {search.failure?.code}</strong>
                    <br />
                    {search.failure?.message}
                  </p>
                </div>
              ) : search.candidates.length === 0 ? (
                <div className="empty-results">
                  <p>No matching candidates. Try another query.</p>
                </div>
              ) : (
                search.candidates.map((candidate) => (
                  <button
                    className="candidate-card"
                    key={candidate.candidateId}
                    disabled={busy}
                    onClick={() => void resolve(candidate.candidateId)}
                  >
                    <strong>{candidate.name}</strong>
                    <span>
                      {candidate.providerSymbol} · {candidate.observedVenue ?? "Venue unknown"}
                    </span>
                    <small>
                      {candidate.assetType} ·{" "}
                      {candidate.quoteUnit.reported ?? "Currency requires quote evidence"}{" "}
                      <b>Inspect →</b>
                    </small>
                  </button>
                ))
              )}
              <p className="evidence-caption">
                Observed {search.observedAt} · {search.source} · cache {search.cache}
              </p>
            </div>
          )}
          {saved.length > 0 && (
            <div className="chapter-form">
              <label>
                Saved instrument
                <select
                  value={instrument?.instrumentId ?? ""}
                  onChange={(event) => {
                    setInstrument(
                      saved.find((item) => item.instrumentId === event.target.value) ?? null,
                    );
                    setDecision(null);
                  }}
                  disabled={busy}
                >
                  <option value="">Choose a saved instrument</option>
                  {saved.map((item) => (
                    <option key={item.instrumentId} value={item.instrumentId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="section-number">02 / EVIDENCE</span>
              <h2>Identity is more than a ticker.</h2>
            </div>
            <span className="tiny-badge">{instrument?.identityStatus ?? "SELECT A CANDIDATE"}</span>
          </div>
          {!instrument ? (
            <div className="empty-results">
              <span className="empty-symbol" aria-hidden="true">
                ◎
              </span>
              <p>
                Choose one search result. Its identity, currency scale and trading-unit evidence
                will appear here.
              </p>
            </div>
          ) : (
            <div className="chapter-form">
              <h3>{instrument.name}</h3>
              <dl className="evidence-grid">
                <dt>Security ID</dt>
                <dd>{instrument.instrumentId}</dd>
                <dt>Listing ID</dt>
                <dd>{instrument.listingId}</dd>
                <dt>Requested → returned</dt>
                <dd>
                  {instrument.requestedSymbol} → {instrument.returnedSymbol}
                </dd>
                <dt>Observed venue / MIC</dt>
                <dd>
                  {instrument.observedVenue ?? "Unknown"} / {instrument.venueMic ?? "Unknown"}
                </dd>
                <dt>Quote unit</dt>
                <dd>
                  {instrument.quoteUnit.reported ?? "Unknown"} →{" "}
                  {instrument.quoteUnit.currency ?? "Unknown"} ×{" "}
                  {instrument.quoteUnit.scaleToCurrency ?? "Unknown"}
                </dd>
                <dt>Legal tick / lot</dt>
                <dd>
                  {instrument.tickSize ?? "Unknown"} / {instrument.lotSize ?? "Unknown"}
                </dd>
                <dt>Trading evidence</dt>
                <dd>{instrument.tradingUnitEvidence ?? "Not established"}</dd>
                <dt>Source / revision</dt>
                <dd>
                  {instrument.source} / {instrument.revision}
                </dd>
                <dt>Observed at</dt>
                <dd>{instrument.observedAt}</dd>
              </dl>
              <p className="results-note">{instrument.quoteUnit.evidence}</p>
              <ul className="evidence-warnings">
                {instrument.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void evaluate();
                }}
              >
                <fieldset disabled={busy}>
                  <label>
                    Evaluate against mandate
                    <select
                      required
                      value={mandateId}
                      onChange={(event) => {
                        setMandateId(event.target.value);
                        setDecision(null);
                      }}
                    >
                      <option value="">Select a saved mandate</option>
                      {mandates.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · revision {item.revision}
                        </option>
                      ))}
                    </select>
                  </label>
                  {mandates.length === 0 && (
                    <p className="field-hint">
                      Create a mandate in Chapter 1 first, then return here.
                    </p>
                  )}
                  <button className="button primary" disabled={!mandateId}>
                    Evaluate eligibility
                  </button>
                </fieldset>
              </form>
              {decision && (
                <div className="eligibility-result">
                  <h3>Eligibility: {decision.status}</h3>
                  <p className="evidence-caption">
                    {decision.policyVersion} · mandate revision {decision.mandateRevision} ·
                    instrument revision {decision.instrumentRevision}
                  </p>
                  <ul className="reason-list">
                    {decision.findings.map((finding) => (
                      <li key={finding.code}>
                        <span
                          className={
                            "finding-status " +
                            (finding.status === "unknown" ? "not_evaluable" : finding.status)
                          }
                        >
                          {finding.status}
                        </span>
                        <div>
                          <strong>{finding.code}</strong>
                          <p>{finding.reason}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      <section className="panel alias-lab">
        <div className="panel-heading">
          <div>
            <span className="section-number">03 / IDENTITY CONTINUITY</span>
            <h2>A new ticker. The same listing.</h2>
          </div>
          <span className="tiny-badge">SYNTHETIC D02 EXAMPLE</span>
        </div>
        <div className="chapter-form">
          <p>
            AUR-OLD becomes AURA at 2026-01-01 00:00:00 UTC. The interval end is exclusive. Inspect
            the package resolver's answer at each boundary.
          </p>
          <div className="scenario-row">
            <button
              className="chip"
              disabled={busy}
              onClick={() => void inspectAlias("AUR-OLD", "2025-12-31T23:59:59Z")}
            >
              Old ticker before change
            </button>
            <button
              className="chip"
              disabled={busy}
              onClick={() => void inspectAlias("AUR-OLD", "2026-01-01T00:00:00Z")}
            >
              Old ticker at change
            </button>
            <button
              className="chip"
              disabled={busy}
              onClick={() => void inspectAlias("AURA", "2026-01-01T00:00:00Z")}
            >
              New ticker at change
            </button>
          </div>
          {alias && (
            <p className="alias-result" role="status">
              <strong>{alias.status}</strong> · {alias.canonicalId ?? "No unique listing"}
              <br />
              {alias.reason}
            </p>
          )}
          <p className="evidence-caption">
            fintech-algorithms 0.13.1 · D02-F03-A01 · verified package fixture parity; independent
            interval expectations in this project's tests.
          </p>
        </div>
      </section>
      <footer className="page-footer">
        <span>Portfolio Atlas · Chapter 2</span>
        <span>Next: validate candles against this identity.</span>
      </footer>
    </LearningShell>
  );
}
