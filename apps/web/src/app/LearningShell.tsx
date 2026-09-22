import type { ReactNode } from "react";
const chapters = [
  { id: 7, title: "Research & evidence", hash: "#research" },
  { id: 6, title: "Value & benchmark", hash: "#valuation" },
  { id: 5, title: "Portfolio book", hash: "#book" },
  { id: 4, title: "Actions & currency", hash: "#actions" },
  { id: 3, title: "Candle quality", hash: "#market-data" },
  { id: 1, title: "Mandate lab", hash: "#mandates" },
  { id: 2, title: "Instrument discovery", hash: "#instruments" },
].sort((a, b) => a.id - b.id);
export function LearningShell({ active, children }: { active: number; children: ReactNode }) {
  const chapter = chapters.find((item) => item.id === active);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#desk"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("desk")?.focus();
        }}
      >
        Skip to learning desk
      </a>
      <aside className="sidebar">
        <a className="brand" href="#mandates" aria-label="Portfolio Atlas home">
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
          {chapters.map((item) => (
            <a
              key={item.id}
              className={"nav-item " + (active === item.id ? "active" : "")}
              href={item.hash}
              aria-current={active === item.id ? "page" : undefined}
            >
              <span>{String(item.id).padStart(2, "0")}</span>
              {item.title}
              <i aria-hidden="true">↗</i>
            </a>
          ))}
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
            <span style={{ width: (active / 17) * 100 + "%" }} />
          </div>
          <small>CHAPTER {String(active).padStart(2, "0")} / 17</small>
        </div>
        <div className="sidebar-footer">
          THE FINTECH BUILDER<span>Learn. Build. Understand.</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>
            <strong>{chapter?.title}</strong>
          </span>
          <div>
            <span className="connection-dot" />
            Local learning environment
          </div>
        </header>
        <main id="desk" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
