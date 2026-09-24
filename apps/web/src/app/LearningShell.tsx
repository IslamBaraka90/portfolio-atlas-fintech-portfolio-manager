import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "../shared/session";
import { useLive } from "../shared/live";
import { BrandMark } from "../design-system/BrandMark";
import { useThemePreference, type ThemePreference } from "../design-system/theme";
import { courseChapters, courseParts, locateChapter } from "./course";

// Open Core WEB-APF-01 analytics shell with a WEB-GNV-08 persistent side rail.
// At <=1024px the rail becomes a modal navigation panel (Escape closes it and
// focus returns to the Menu button); at <=767px the content uses one column.
export function LearningShell({ active, children }: { active: number; children: ReactNode }) {
  const session = useSession();
  const { part, chapter } = locateChapter(active);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLElement>(null);
  const position = courseChapters.findIndex((item) => item.id === active) + 1;

  useEffect(() => {
    if (!menuOpen) return;
    rail.current?.querySelector<HTMLElement>("a[aria-current], a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    document.title = (chapter ? chapter.title + " · " : "") + "Portfolio Atlas";
  }, [chapter]);

  return (
    <div className="app-shell" data-menu={menuOpen ? "open" : "closed"}>
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
      <aside
        ref={rail}
        className="sidebar"
        id="course-navigation"
        aria-label="Course navigation"
        {...(menuOpen ? { role: "dialog", "aria-modal": true } : {})}
      >
        <div className="sidebar-brand">
          <a className="brand" href="#mandates" aria-label="Portfolio Atlas home">
            <BrandMark variant="reversed" size={48} />
            <span className="brand-text">
              <span className="brand-kicker">The Fintech Builder</span>
              <strong>Portfolio Atlas</strong>
            </span>
          </a>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => {
              setMenuOpen(false);
              menuButton.current?.focus();
            }}
          >
            Close
          </button>
        </div>
        <nav aria-label="Course chapters" className="course-nav">
          {courseParts.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-group-title">{group.title}</p>
              <ul>
                {group.chapters.map((item) => (
                  <li key={item.id}>
                    <a
                      className={"nav-item" + (active === item.id ? " active" : "")}
                      href={item.hash}
                      aria-current={active === item.id ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="nav-number" aria-hidden="true">
                        {String(item.id).padStart(2, "0")}
                      </span>
                      <span className="nav-title">{item.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="sidebar-progress">
          <div className="sidebar-progress-label">
            <span>Course progress</span>
            <span>
              {position} of {courseChapters.length}
            </span>
          </div>
          <div
            className="progress"
            role="progressbar"
            aria-label="Course position"
            aria-valuemin={1}
            aria-valuemax={courseChapters.length}
            aria-valuenow={position}
          >
            <span style={{ width: (position / courseChapters.length) * 100 + "%" }} />
          </div>
          <p>Learn. Build. Understand.</p>
        </div>
      </aside>
      <button
        type="button"
        className="sidebar-backdrop"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
      <div className="main-shell">
        <header className="topbar">
          <button
            ref={menuButton}
            type="button"
            className="menu-button"
            aria-controls="course-navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="menu-glyph" />
            Menu
          </button>
          <nav aria-label="Breadcrumb" className="topbar-breadcrumb">
            <ol>
              <li className="optional">Portfolio Atlas</li>
              {part && <li className="optional">{part.title}</li>}
              <li aria-current="page">
                <strong>{chapter?.title}</strong>
              </li>
            </ol>
          </nav>
          <div className="topbar-actions">
            <LiveChip />
            <ThemeSwitch />
            <a className="session-link" href="#governance">
              <span className="connection-dot" aria-hidden="true" />
              {session?.mode === "configured_sessions"
                ? (session.actor?.name ?? "Sign in")
                : "Local OS owner"}
            </a>
          </div>
        </header>
        <main id="desk" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          <span>Portfolio Atlas · an open educational portfolio manager</span>
          <span>Analysis, not advice. Paper execution only.</span>
        </footer>
      </div>
    </div>
  );
}

const cadenceShort = { eod: "end of day", "15m": "15 min", "5m": "5 min", "1m": "1 min" };
function LiveChip() {
  const { status } = useLive();
  if (!status) return null;
  const live = status.policy.mode === "live";
  const failing = status.health.status === "backing_off";
  return (
    <a
      className={"live-chip" + (live ? " is-live" : "") + (failing ? " is-failing" : "")}
      href="#live"
      aria-label={
        "Market data: " +
        (live ? "live" : "demo") +
        ", refresh " +
        cadenceShort[status.policy.cadence] +
        (failing ? ", provider backing off" : "")
      }
    >
      <span className="dot" aria-hidden="true" />
      <span>
        {live ? "Live" : "Demo"} · {cadenceShort[status.policy.cadence]}
      </span>
    </a>
  );
}

function ThemeSwitch() {
  const [preference, setPreference] = useThemePreference();
  return (
    <label className="theme-switch">
      <span className="sr-only">Colour theme</span>
      <select
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </label>
  );
}
