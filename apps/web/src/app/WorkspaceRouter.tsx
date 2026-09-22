import { MonitorDesk } from "../features/monitoring/MonitorDesk";
import { OperationsDesk } from "../features/operations/OperationsDesk";
import { OrderDesk } from "../features/orders/OrderDesk";
import { RebalanceDesk } from "../features/rebalancing/RebalanceDesk";
import { ValidationDesk } from "../features/validation/ValidationDesk";
import { ConstructionDesk } from "../features/construction/ConstructionDesk";
import { RiskDesk } from "../features/risk/RiskDesk";
import { ResearchDesk } from "../features/research/ResearchDesk";
import { CorporateActionsDesk } from "../features/corporate-actions/CorporateActionsDesk";
import { PortfolioBook } from "../features/portfolio/PortfolioBook";
import { ValuationDesk } from "../features/valuation/ValuationDesk";
import { DataQualityDesk } from "../features/data-quality/DataQualityDesk";
import { useEffect, useState } from "react";
import { App } from "./App";
import { InstrumentExplorer } from "../features/instruments/InstrumentExplorer";

// Learning pages share a small hash router. Records live in the API;
// switching chapters does not create another application session.
export function WorkspaceRouter() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const changed = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  return hash.split("?")[0] === "#monitoring" ? (
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
}
