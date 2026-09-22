import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  bookStateSchema,
  portfolioSchema,
  instrumentSchema,
  postingInputSchema,
  type BookState,
  type Portfolio,
  type Instrument,
  type PostingInput,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "./portfolio.css";

export function PortfolioBook() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]),
    [instruments, setInstruments] = useState<Instrument[]>([]);
  const [portfolioId, setPortfolioId] = useState(""),
    [instrumentId, setInstrumentId] = useState("");
  const [state, setState] = useState<BookState | null>(null),
    [storage, setStorage] = useState("");
  const [kind, setKind] = useState<PostingInput["kind"]>("deposit"),
    [currency, setCurrency] = useState("USD");
  const [amount, setAmount] = useState("10000"),
    [shares, setShares] = useState("10"),
    [price, setPrice] = useState("100"),
    [fee, setFee] = useState("5");
  const [ratio, setRatio] = useState("2"),
    [reservation, setReservation] = useState(""),
    [evidence, setEvidence] = useState("authored-lesson");
  const [sourceRef, setSourceRef] = useState("lesson-" + crypto.randomUUID()),
    [occurredAt, setOccurredAt] = useState("2026-09-01T15:00:00Z");
  const [note, setNote] = useState(""),
    [reason, setReason] = useState("Correct the lesson's imported event"),
    [correctionId, setCorrectionId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [lastPosted, setLastPosted] = useState<PostingInput | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/portfolios", z.array(portfolioSchema), abort.signal),
      read("/instruments", z.array(instrumentSchema), abort.signal),
    ])
      .then(([p, i]) => {
        setPortfolios(p.data);
        setPortfolioId(p.data[0]?.id ?? "");
        setInstruments(i.data);
        setInstrumentId(
          i.data.find((row) => row.identityStatus === "synthetic_verified")?.instrumentId ?? "",
        );
        setStorage(p.metadata.storage);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    setState(null);
    setLastPosted(null);
    setCorrectionId("");
    setNotice("");
    if (!portfolioId) return;
    const abort = new AbortController();
    read("/portfolios/" + encodeURIComponent(portfolioId) + "/book", bookStateSchema, abort.signal)
      .then((result) => setState(result.data))
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
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function input(): PostingInput {
    const base = { portfolioId, sourceRef, occurredAt, note };
    const instrument = instruments.find((row) => row.instrumentId === instrumentId);
    const asset = { instrumentId, instrumentRevision: instrument?.revision ?? 0 };
    let value: unknown;
    if (kind === "buy" || kind === "sell")
      value = {
        ...base,
        ...asset,
        kind,
        currency,
        quantity: shares,
        unitPrice: price,
        fee,
        reservationId: reservation || null,
      };
    else if (kind === "split") value = { ...base, ...asset, kind, ratio, evidenceRef: evidence };
    else if (kind === "dividend")
      value = { ...base, ...asset, kind, currency, amount, evidenceRef: evidence };
    else if (kind === "release") value = { ...base, kind, reservationId: reservation };
    else if (kind === "reserve")
      value = { ...base, kind, currency, amount, reservationId: reservation };
    else value = { ...base, kind, currency, amount };
    return postingInputSchema.parse(value);
  }
  function post() {
    void perform(async () => {
      const value = input(),
        result = await write("POST", "/ledger/events", value, bookStateSchema);
      setState(result.data);
      setLastPosted(value);
      setSourceRef("lesson-" + crypto.randomUUID());
      setNotice("Event accepted. Balances rebuilt from the journal.");
    });
  }
  function correct(replace: boolean) {
    void perform(async () => {
      const result = await write(
        "POST",
        "/ledger/corrections",
        {
          portfolioId,
          originalEventId: correctionId,
          reason,
          replacement: replace ? input() : null,
        },
        bookStateSchema,
      );
      setState(result.data);
      setCorrectionId("");
      setSourceRef("lesson-" + crypto.randomUUID());
      setLastPosted(null);
      setNotice("Correction appended. The original event and journal remain visible.");
    });
  }
  const hasAsset = ["buy", "sell", "split", "dividend"].includes(kind);
  const trade = kind === "buy" || kind === "sell";
  return (
    <LearningShell active={5}>
      <div className="chapter-page">
        <div className="eyebrow">CHAPTER 05 / THE BOOK OF RECORD</div>
        <h1>
          Every balance
          <br />
          has a beginning.
        </h1>
        <p className="chapter-intro">
          Post an event, follow its journal, and rebuild the cash and lots. All amounts below are
          teaching entries. Deferred paper fills and custody acknowledgments are managed in Chapter
          13.
        </p>
        {error && (
          <div role="alert" tabIndex={-1} ref={errorRef} className="error-banner">
            {error}
          </div>
        )}
        {notice && (
          <p role="status" className="chapter-notice">
            {notice}
          </p>
        )}
        <section className="chapter-panel">
          <h2>01 / Choose your book</h2>
          <p className="chapter-muted">
            Create a portfolio in the <a href="#mandates">Mandate lab</a> and save an AURA
            instrument in <a href="#instruments">Instrument discovery</a>.{" "}
            {storage === "sqlite"
              ? "Records persist in local SQLite."
              : "This test session uses ephemeral SQLite."}
          </p>
          <label>
            Portfolio
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
        </section>
        <section className="chapter-panel">
          <h2>02 / Post a teaching event</h2>
          <p className="chapter-muted">
            Start with a USD 10,000 deposit, then buy 10 shares at 100 with a 5 fee. Expected cash:
            8,995. Decimal strings preserve every cent.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              post();
            }}
          >
            <fieldset disabled={busy || !portfolioId} className="book-fields">
              <div className="chapter-form">
                <label>
                  Event type
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as PostingInput["kind"])}
                  >
                    {[
                      "deposit",
                      "withdrawal",
                      "buy",
                      "sell",
                      "fee",
                      "dividend",
                      "split",
                      "reserve",
                      "release",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Effective time (UTC)
                  <input
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Source reference
                  <input
                    value={sourceRef}
                    onChange={(e) => setSourceRef(e.target.value)}
                    required
                    minLength={3}
                  />
                </label>
              </div>
              <div className="chapter-form">
                {hasAsset && (
                  <label>
                    Saved instrument
                    <select
                      value={instrumentId}
                      onChange={(e) => {
                        setInstrumentId(e.target.value);
                        const i = instruments.find((r) => r.instrumentId === e.target.value);
                        if (i?.quoteUnit.currency) setCurrency(i.quoteUnit.currency);
                      }}
                    >
                      <option value="">Choose an instrument</option>
                      {instruments.map((i) => (
                        <option key={i.instrumentId} value={i.instrumentId}>
                          {i.returnedSymbol} · revision {i.revision} · {i.identityStatus}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!["split", "release"].includes(kind) && (
                  <label>
                    Currency
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {["USD", "EUR", "GBP", "EGP", "SAR"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                )}
                {!trade && !["split", "release"].includes(kind) && (
                  <label>
                    Amount
                    <input
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </label>
                )}
                {trade && (
                  <>
                    <label>
                      Quantity
                      <input
                        inputMode="decimal"
                        value={shares}
                        onChange={(e) => setShares(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Unit price
                      <input
                        inputMode="decimal"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Fee
                      <input
                        inputMode="decimal"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        required
                      />
                    </label>
                  </>
                )}
                {kind === "split" && (
                  <label>
                    New shares per old share
                    <input value={ratio} onChange={(e) => setRatio(e.target.value)} required />
                  </label>
                )}
                {["buy", "reserve", "release"].includes(kind) && (
                  <label>
                    Reservation reference {kind === "buy" ? "(optional)" : ""}
                    <input value={reservation} onChange={(e) => setReservation(e.target.value)} />
                  </label>
                )}
                {["split", "dividend"].includes(kind) && (
                  <label>
                    Action evidence reference
                    <input
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      required
                    />
                  </label>
                )}
              </div>
              <label>
                Event note
                <input value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <button type="submit" className="primary">
                Post event
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!lastPosted}
                onClick={() =>
                  void perform(async () => {
                    if (!lastPosted) return;
                    const result = await write(
                      "POST",
                      "/ledger/events",
                      lastPosted,
                      bookStateSchema,
                    );
                    setState(result.data);
                    setNotice("Replayed the same command. No duplicate event was added.");
                  })
                }
              >
                Replay last command
              </button>
            </fieldset>
          </form>
        </section>
        {state && (
          <>
            <section className="chapter-panel">
              <h2>03 / Cash and holdings</h2>
              <div className="chapter-metrics">
                <div>
                  <span>JOURNAL CHECKPOINT</span>
                  <strong>{state.book.checkpoint}</strong>
                </div>
                <div>
                  <span>BOOK RECONCILIATION</span>
                  <strong>{state.book.reconciled ? "Matched" : "Review"}</strong>
                </div>
                <div>
                  <span>OPEN LOTS</span>
                  <strong>{state.book.lots.length}</strong>
                </div>
                <div>
                  <span>EVENTS RETAINED</span>
                  <strong>{state.events.length}</strong>
                </div>
              </div>
              {state.book.warnings.map((w) => (
                <p key={w} className="chapter-muted">
                  {w}
                </p>
              ))}
              <div className="chapter-table-wrap" tabIndex={0} aria-label="Cash balances">
                <table>
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th>Settled cash</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.book.cash.map((c) => (
                      <tr key={c.currency}>
                        <th>{c.currency}</th>
                        <td data-testid="settled-cash">{c.settled}</td>
                        <td>{c.reserved}</td>
                        <td>{c.available}</td>
                        <td>
                          {c.pending} (economic {c.economic ?? c.settled})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chapter-table-wrap" tabIndex={0} aria-label="Position cost basis">
                <table>
                  <thead>
                    <tr>
                      <th>Instrument</th>
                      <th>Quantity</th>
                      <th>Pending</th>
                      <th>Book cost</th>
                      <th>Unit cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.book.positions.map((p) => (
                      <tr key={p.instrumentId}>
                        <th>
                          {instruments.find((i) => i.instrumentId === p.instrumentId)
                            ?.returnedSymbol ?? p.instrumentId}
                        </th>
                        <td data-testid="position-quantity">{p.quantity}</td>
                        <td>
                          {p.pendingQuantity} (custody {p.custodyQuantity ?? p.quantity})
                        </td>
                        <td>
                          {p.costBasis} {p.currency}
                        </td>
                        <td>{p.unitCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="chapter-muted">
                Book cost is the acquisition basis. Chapter 6 supplies market valuation.
              </p>
              <details>
                <summary>Inspect FIFO lot evidence</summary>
                <div className="chapter-table-wrap" tabIndex={0}>
                  <table>
                    <thead>
                      <tr>
                        <th>Acquisition event</th>
                        <th>Acquired</th>
                        <th>Remaining shares</th>
                        <th>Remaining cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.book.lots.map((l) => (
                        <tr key={l.lotId}>
                          <td>{l.acquisitionEventId}</td>
                          <td>{l.acquiredAt}</td>
                          <td>{l.quantityRemaining}</td>
                          <td>
                            {l.costRemaining} {l.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className="chapter-panel">
              <h2>04 / Follow the event trail</h2>
              {state.events.length === 0 && <p>No events posted yet.</p>}
              {state.events.map((event) => (
                <details key={event.id} className="book-event">
                  <summary>
                    #{event.sequence} · {event.input.kind} · {event.input.sourceRef}
                  </summary>
                  <p className="chapter-muted">
                    Effective {event.input.occurredAt} · recorded {event.recordedAt} · event{" "}
                    {event.id}
                  </p>
                  <pre>{JSON.stringify(event.input, null, 2)}</pre>
                  <div className="chapter-table-wrap" tabIndex={0}>
                    <table>
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Side</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.journal
                          .find((j) => j.eventId === event.id)
                          ?.lines.map((l, index) => (
                            <tr key={index}>
                              <td>{l.account}</td>
                              <td>{l.side}</td>
                              <td>
                                {l.amount} {l.currency}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {state.journal.find((j) => j.eventId === event.id)?.kind === "memo" && (
                    <p>Memo event: changes quantity or reservations without moving cash.</p>
                  )}
                </details>
              ))}
            </section>
            <section className="chapter-panel">
              <h2>05 / Correct with an audit trail</h2>
              <p className="chapter-muted">
                Only the latest active event can be corrected. Replacement uses the posting form
                above with a new source reference. Reversal and replacement commit together; invalid
                replacements leave the book unchanged.
              </p>
              <fieldset disabled={busy || !state.events.length} className="book-fields">
                <label>
                  Original event
                  <select value={correctionId} onChange={(e) => setCorrectionId(e.target.value)}>
                    <option value="">Choose an event</option>
                    {state.events
                      .filter((e) => e.input.kind !== "reversal")
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          #{e.sequence} · {e.input.kind} · {e.input.sourceRef}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Correction reason
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={10}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={!correctionId || reason.trim().length < 10}
                  onClick={() => correct(false)}
                >
                  Append reversal only
                </button>
                <button
                  className="primary"
                  disabled={!correctionId || reason.trim().length < 10}
                  onClick={() => correct(true)}
                >
                  Reverse and replace from form
                </button>
              </fieldset>
            </section>
          </>
        )}
      </div>
    </LearningShell>
  );
}
