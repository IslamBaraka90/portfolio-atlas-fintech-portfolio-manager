const ReportDesk = lazy(() =>
  import("../features/reports/ReportDesk").then((m) => ({ default: m.ReportDesk })),
);
const PerformanceDesk = lazy(() =>
  import("../features/performance/PerformanceDesk").then((m) => ({ default: m.PerformanceDesk })),
);
const MonitorDesk = lazy(() =>
  import("../features/monitoring/MonitorDesk").then((m) => ({ default: m.MonitorDesk })),
);
const OperationsDesk = lazy(() =>
  import("../features/operations/OperationsDesk").then((m) => ({ default: m.OperationsDesk })),
);
const OrderDesk = lazy(() =>
  import("../features/orders/OrderDesk").then((m) => ({ default: m.OrderDesk })),
);
const RebalanceDesk = lazy(() =>
  import("../features/rebalancing/RebalanceDesk").then((m) => ({ default: m.RebalanceDesk })),
);
const ValidationDesk = lazy(() =>
  import("../features/validation/ValidationDesk").then((m) => ({ default: m.ValidationDesk })),
);
const ConstructionDesk = lazy(() =>
  import("../features/construction/ConstructionDesk").then((m) => ({
    default: m.ConstructionDesk,
  })),
);
const RiskDesk = lazy(() =>
  import("../features/risk/RiskDesk").then((m) => ({ default: m.RiskDesk })),
);
const ResearchDesk = lazy(() =>
  import("../features/research/ResearchDesk").then((m) => ({ default: m.ResearchDesk })),
);
const CorporateActionsDesk = lazy(() =>
  import("../features/corporate-actions/CorporateActionsDesk").then((m) => ({
    default: m.CorporateActionsDesk,
  })),
);
const PortfolioBook = lazy(() =>
  import("../features/portfolio/PortfolioBook").then((m) => ({ default: m.PortfolioBook })),
);
const ValuationDesk = lazy(() =>
  import("../features/valuation/ValuationDesk").then((m) => ({ default: m.ValuationDesk })),
);
const DataQualityDesk = lazy(() =>
  import("../features/data-quality/DataQualityDesk").then((m) => ({ default: m.DataQualityDesk })),
);
import { lazy, Suspense, useEffect, useState } from "react";
import { useSession, refreshSession } from "../shared/session";
const GovernanceDesk = lazy(() =>
  import("../features/governance/GovernanceDesk").then((m) => ({ default: m.GovernanceDesk })),
);
const LiveRuntimeDesk = lazy(() =>
  import("../features/live/LiveRuntimeDesk").then((m) => ({ default: m.LiveRuntimeDesk })),
);
const QuoteBoardDesk = lazy(() =>
  import("../features/live/QuoteBoardDesk").then((m) => ({ default: m.QuoteBoardDesk })),
);
const LiveHistoryDesk = lazy(() =>
  import("../features/live/LiveHistoryDesk").then((m) => ({ default: m.LiveHistoryDesk })),
);
const LiveFxDesk = lazy(() =>
  import("../features/live/LiveFxDesk").then((m) => ({ default: m.LiveFxDesk })),
);
const LivePortfolioDesk = lazy(() =>
  import("../features/live/LivePortfolioDesk").then((m) => ({ default: m.LivePortfolioDesk })),
);
const LiveRiskDesk = lazy(() =>
  import("../features/live/LiveRiskDesk").then((m) => ({ default: m.LiveRiskDesk })),
);
const App = lazy(() => import("./App").then((m) => ({ default: m.App })));
const InstrumentExplorer = lazy(() =>
  import("../features/instruments/InstrumentExplorer").then((m) => ({
    default: m.InstrumentExplorer,
  })),
);

// Learning pages share a small hash router. Records live in the API;
// switching chapters does not create another application session.
export function WorkspaceRouter() {
  const session = useSession();
  const [sessionError, setSessionError] = useState("");
  useEffect(() => {
    void refreshSession().catch((e) => setSessionError(String(e)));
  }, []);
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  if (!session)
    return (
      <main id="desk" role="status">
        {sessionError || "Loading workspace authority…"}
        {sessionError && (
          <button
            onClick={() =>
              void refreshSession()
                .then(() => setSessionError(""))
                .catch((e) => setSessionError(String(e)))
            }
          >
            Retry connection
          </button>
        )}
      </main>
    );
  const page =
    hash === "#governance" || (session.mode === "configured_sessions" && !session.actor) ? (
      <GovernanceDesk />
    ) : hash.split("?")[0] === "#live-risk" ? (
      <LiveRiskDesk />
    ) : hash.split("?")[0] === "#live-portfolio" ? (
      <LivePortfolioDesk />
    ) : hash.split("?")[0] === "#fx" ? (
      <LiveFxDesk />
    ) : hash.split("?")[0] === "#bars" ? (
      <LiveHistoryDesk />
    ) : hash.split("?")[0] === "#quotes" ? (
      <QuoteBoardDesk />
    ) : hash.split("?")[0] === "#live" ? (
      <LiveRuntimeDesk />
    ) : hash.split("?")[0] === "#reports" ? (
      <ReportDesk />
    ) : hash.split("?")[0] === "#performance" ? (
      <PerformanceDesk />
    ) : hash.split("?")[0] === "#monitoring" ? (
      <MonitorDesk />
    ) : hash.split("?")[0] === "#operations" ? (
      <OperationsDesk />
    ) : hash.split("?")[0] === "#orders" ? (
      <OrderDesk />
    ) : hash.split("?")[0] === "#rebalancing" ? (
      <RebalanceDesk />
    ) : hash.split("?")[0] === "#validation" ? (
      <ValidationDesk />
    ) : hash.split("?")[0] === "#construction" ? (
      <ConstructionDesk />
    ) : hash.split("?")[0] === "#risk" ? (
      <RiskDesk />
    ) : hash.split("?")[0] === "#research" ? (
      <ResearchDesk />
    ) : hash.split("?")[0] === "#valuation" ? (
      <ValuationDesk />
    ) : hash.split("?")[0] === "#book" ? (
      <PortfolioBook />
    ) : hash.split("?")[0] === "#actions" ? (
      <CorporateActionsDesk />
    ) : hash.split("?")[0] === "#market-data" ? (
      <DataQualityDesk />
    ) : hash === "#instruments" ? (
      <InstrumentExplorer />
    ) : (
      <App />
    );
  return (
    <Suspense
      fallback={
        <main id="desk" role="status">
          Loading chapter…
        </main>
      }
    >
      {page}
    </Suspense>
  );
}
