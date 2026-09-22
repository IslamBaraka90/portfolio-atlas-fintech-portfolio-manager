import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  lessonSchema,
  mandateInputSchema,
  mandateSchema,
  portfolioSchema,
  evaluationSchema,
  type ApiEnvelope,
  type CandidateAllocation,
  type Evaluation,
  type Lesson,
  type Mandate,
  type MandateInput,
  type Portfolio,
} from "@portfolio-atlas/contracts";
import { ApiError, read, resetCommandKeys, write } from "../shared/api";
import { MandateForm } from "../features/mandates/MandateForm";
import { AllocationEditor } from "../features/mandates/AllocationEditor";
import { EvaluationResults } from "../features/mandates/EvaluationResults";

export function App() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState<MandateInput | null>(null);
  const [allocation, setAllocation] = useState<CandidateAllocation | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioName, setPortfolioName] = useState("My learning portfolio");
  const [dirty, setDirty] = useState(false);
  const [response, setResponse] = useState<ApiEnvelope<Evaluation> | null>(null);
  const [busy, setBusy] = useState<string | null>("Connecting");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [example, saved] = await Promise.all([
          read("/lesson", lessonSchema, controller.signal),
          read("/portfolios", z.array(portfolioSchema), controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const previousSession = sessionStorage.getItem("atlas-session");
        sessionStorage.setItem("atlas-session", example.metadata.sessionId);
        sessionRef.current = example.metadata.sessionId;
        resetCommandKeys();
        setLesson(example.data);
        setAllocation(structuredClone(example.data.scenarios[0]!.allocation));
        setDraft(example.data.mandate);
        setMandate(null);
        setPortfolio(null);
        setResponse(null);
        setDirty(false);
        setPortfolios(saved.data);
        setNotice(
          previousSession && previousSession !== example.metadata.sessionId
            ? "The API restarted. The previous session was cleared; start a new learning portfolio."
            : "Your learning desk is ready. Start with the sample mandate or make it your own.",
        );
        setError(null);
      } catch (failure) {
        if (!controller.signal.aborted) setError(message(failure));
      } finally {
        if (!controller.signal.aborted) setBusy(null);
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function message(failure: unknown) {
    if (failure instanceof ApiError)
      return (
        failure.message +
        " Request: " +
        failure.requestId +
        ". Use Reload session to recover from a stale revision or a restarted server."
      );
    return failure instanceof Error ? failure.message : "Something went wrong. Retry the command.";
  }
  function checkSession(id: string) {
    if (sessionRef.current && sessionRef.current !== id)
      throw new Error(
        "The API restarted and session records were cleared. Use Reload session to begin again.",
      );
  }
  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(message(failure));
    } finally {
      setBusy(null);
    }
  }
  function changeDraft(value: MandateInput) {
    setDraft(value);
    setDirty(true);
    setResponse(null);
  }
  function changeAllocation(value: CandidateAllocation) {
    setAllocation(value);
    setResponse(null);
  }
  async function save() {
    if (!draft) return;
    await run("Saving", async () => {
      const saved =
        mandate && !portfolio && !dirty
          ? await read("/mandates/" + mandate.id, mandateSchema)
          : mandate
            ? await write(
                "PUT",
                "/mandates/" + mandate.id,
                { expectedRevision: mandate.revision, mandate: draft },
                mandateSchema,
              )
            : await write("POST", "/mandates", draft, mandateSchema);
      checkSession(saved.metadata.sessionId);
      setMandate(saved.data);
      setDraft(mandateInputSchema.strip().parse(saved.data));
      setDirty(false);
      setResponse(null);
      if (!portfolio) {
        // If the second request fails, the mandate stays visible and a retry reuses
        // its ID. A portfolio is never reported as created before the API confirms it.
        setNotice("Mandate saved. Creating its learning portfolio…");
        const created = await write(
          "POST",
          "/portfolios",
          { name: portfolioName, mandateId: saved.data.id },
          portfolioSchema,
        );
        checkSession(created.metadata.sessionId);
        setPortfolio(created.data);
        setPortfolios((items) => [
          ...items.filter((item) => item.id !== created.data.id),
          created.data,
        ]);
      }
      setNotice(
        "Saved mandate revision " +
          saved.data.revision +
          ". You can now check the candidate allocation.",
      );
    });
  }
  async function evaluate() {
    if (!mandate || !allocation) return;
    await run("Evaluating", async () => {
      // Use server time for the synthetic snapshot, avoiding browser clock skew.
      const current = await read("/mandates/" + mandate.id, mandateSchema);
      checkSession(current.metadata.sessionId);
      const result = await write(
        "POST",
        "/mandates/" + mandate.id + "/evaluations",
        {
          expectedRevision: mandate.revision,
          allocation: { ...allocation, asOf: current.metadata.generatedAt },
        },
        evaluationSchema,
      );
      checkSession(result.metadata.sessionId);
      setResponse(result);
      setNotice(
        "Evaluation received from the API for mandate revision " +
          result.data.mandateRevision +
          ".",
      );
    });
  }
  async function openPortfolio(id: string) {
    const selected = portfolios.find((item) => item.id === id);
    if (!selected) return;
    await run("Opening", async () => {
      const saved = await read("/mandates/" + selected.mandateId, mandateSchema);
      checkSession(saved.metadata.sessionId);
      setMandate(saved.data);
      setDraft(mandateInputSchema.strip().parse(saved.data));
      setPortfolio(selected);
      setPortfolioName(selected.name);
      setDirty(false);
      setResponse(null);
      setNotice(
        "Opened " +
          selected.name +
          ". The allocation editor is a separate candidate, ready for a new evaluation.",
      );
    });
  }
  function newPortfolio() {
    if (!lesson) return;
    // A deliberate new resource must use a fresh command key, even if its inputs match.
    resetCommandKeys();
    setMandate(null);
    setPortfolio(null);
    setDraft(structuredClone(lesson.mandate));
    setPortfolioName("My learning portfolio");
    setDirty(false);
    setResponse(null);
    setError(null);
    setAllocation(structuredClone(lesson.scenarios[0]!.allocation));
    setNotice("New portfolio draft. Saved portfolios remain available for this API session.");
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#desk">
        Skip to learning desk
      </a>
      <aside className="sidebar">
        <a className="brand" href="#desk" aria-label="Portfolio Atlas home">
          <span className="brand-icon" aria-hidden="true">
            A<span>·</span>
          </span>
          <span>
            portfolio
            <strong>
              atlas<span aria-hidden="true">+</span>
            </strong>
          </span>
        </a>
        <div className="sidebar-label">THE LEARNING DESK</div>
        <nav aria-label="Course chapters">
          <a className="nav-item active" href="#desk" aria-current="page">
            <span>01</span>Mandate lab<i>↗</i>
          </a>
          <span className="nav-item muted">
            <span>02</span>Instrument discovery
          </span>
          <span className="nav-item muted">
            <span>03</span>Market data quality
          </span>
        </nav>
        <div className="sidebar-note">
          <span className="small-orbit" aria-hidden="true">
            ◎
          </span>
          <h2>
            Good portfolios start
            <br />
            with clear rules.
          </h2>
          <p>Build the foundation, one decision at a time.</p>
          <div className="course-progress">
            <span />
          </div>
          <small>CHAPTER 01 / 17</small>
        </div>
        <div className="sidebar-footer">
          THE FINTECH BUILDER<span>Learn. Build. Understand.</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span> <strong>Mandate lab</strong>
          </span>
          <div>
            <span className="connection-dot" />
            Local learning environment
          </div>
        </header>
        <main id="desk">
          <section className="hero">
            <div>
              <div className="eyebrow">
                <span>CHAPTER 01</span> THE FOUNDATION
              </div>
              <h1>
                Define the rules.
                <br />
                <em>Understand every decision.</em>
              </h1>
              <p>
                A portfolio starts with a purpose and a set of boundaries.
                <br className="desktop-break" /> Write your mandate, test an allocation, and follow
                the reasons.
              </p>
            </div>
            <div className="hero-stamp" aria-hidden="true">
              <span>
                PORTFOLIO
                <br />
                ATLAS
              </span>
              <strong>01</strong>
              <span>MANDATE & UNIVERSE</span>
            </div>
          </section>
          <div className="session-strip">
            <span className="badge synthetic">Synthetic data</span>
            <span>
              <strong>Session-only storage.</strong> Restarting the API clears portfolios, revisions
              and evaluations.
            </span>
            <button
              className="text-button"
              type="button"
              disabled={!!busy}
              onClick={() => {
                setBusy("Connecting");
                setReload((value) => value + 1);
              }}
            >
              Reload session ↻
            </button>
          </div>
          <div className="journey">
            <span>
              <b>1</b> Define your mandate
            </span>
            <span className="journey-line" />
            <span>
              <b>2</b> Shape an allocation
            </span>
            <span className="journey-line" />
            <span>
              <b>3</b> Inspect the reasons
            </span>
          </div>
          {error && (
            <div className="error-banner" role="alert" tabIndex={-1} ref={errorRef}>
              <strong>The request could not be completed.</strong>
              <p>{error}</p>
            </div>
          )}
          <p className="live-notice" role="status">
            {busy ? busy + "…" : notice}
          </p>
          {!lesson || !draft || !allocation ? (
            <div className="panel loading-panel">
              {busy
                ? "Connecting to your local API…"
                : "The desk is waiting for the API. Start it, then select Reload session."}
            </div>
          ) : (
            <>
              {portfolios.length > 0 && (
                <div className="saved-portfolios">
                  <label>
                    Session portfolios
                    <select
                      aria-label="Open saved portfolio"
                      disabled={!!busy}
                      value={portfolio?.id ?? ""}
                      onChange={(event) => void openPortfolio(event.target.value)}
                    >
                      <option value="">Choose a saved portfolio</option>
                      {portfolios.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="button secondary" disabled={!!busy} onClick={newPortfolio}>
                    + New portfolio
                  </button>
                </div>
              )}
              <div className="desk-grid">
                <section className="panel mandate-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-number">01 / MANDATE</span>
                      <h2>Your portfolio, your rules.</h2>
                    </div>
                    <span className="tiny-badge">
                      {mandate ? "REV " + mandate.revision : "DRAFT"}
                    </span>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void save();
                    }}
                  >
                    <fieldset disabled={!!busy}>
                      <label>
                        Portfolio name
                        <input
                          required
                          minLength={3}
                          maxLength={80}
                          value={portfolioName}
                          disabled={!!portfolio}
                          onChange={(event) => setPortfolioName(event.target.value)}
                        />
                      </label>
                      <MandateForm
                        value={draft}
                        onChange={changeDraft}
                        saved={!!mandate}
                        currencyLocked={!!portfolio}
                      />
                    </fieldset>
                  </form>
                  {mandate && (
                    <div className="mandate-summary">
                      <strong>{portfolio?.name ?? "Mandate saved; portfolio pending"}</strong>
                      <span>
                        {mandate.baseCurrency} base · {mandate.horizonYears}-year horizon · revision{" "}
                        {mandate.revision}
                      </span>
                      <span>
                        {dirty
                          ? "Unsaved changes — save before evaluating."
                          : "Saved in this API session."}
                      </span>
                    </div>
                  )}
                </section>
                <div className="right-column">
                  <section className="panel allocation-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-number">02 / CANDIDATE ALLOCATION</span>
                        <h2>Put your mandate to the test.</h2>
                      </div>
                      <span className="tiny-badge">LONG ONLY</span>
                    </div>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void evaluate();
                      }}
                    >
                      <fieldset disabled={!!busy}>
                        <AllocationEditor
                          value={allocation}
                          scenarios={lesson.scenarios}
                          onChange={changeAllocation}
                        />
                        <div className="evaluate-row">
                          <p>
                            {!mandate || !portfolio
                              ? "Create your portfolio to begin."
                              : dirty
                                ? "Save your changes before checking."
                                : "Rules run on the backend. Reasons arrive here."}
                          </p>
                          <button
                            className="button primary"
                            disabled={!mandate || !portfolio || dirty}
                            type="submit"
                          >
                            Check allocation <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  </section>
                  <section className="panel results-panel" aria-labelledby="results-title">
                    <div className="panel-heading">
                      <div>
                        <span className="section-number">03 / DECISION EXPLAINER</span>
                        <h2 id="results-title">Follow the evidence.</h2>
                      </div>
                      <span className="tiny-badge">
                        {response ? "SERVER RESULT" : "AWAITING CHECK"}
                      </span>
                    </div>
                    <EvaluationResults response={response} />
                  </section>
                </div>
              </div>
              <div className="lesson-note">
                <span>↳</span>
                <p>
                  <strong>The idea to take with you</strong>A valid input can still break a
                  portfolio rule. A missing classification means we do not yet have enough evidence.
                  Those are different outcomes.
                </p>
                <span className="lesson-note-tag">CHAPTER 01 TAKEAWAY</span>
              </div>
            </>
          )}
          <footer className="page-footer">
            <span>Portfolio Atlas · An open learning project by The Fintech Builder</span>
            <span>Teaching policies · Simulated holdings · No live trading</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
