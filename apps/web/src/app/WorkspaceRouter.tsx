import { CorporateActionsDesk } from "../features/corporate-actions/CorporateActionsDesk";
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
  return hash.split("?")[0] === "#actions" ? (
    <CorporateActionsDesk />
  ) : hash.split("?")[0] === "#market-data" ? (
    <DataQualityDesk />
  ) : hash === "#instruments" ? (
    <InstrumentExplorer />
  ) : (
    <App />
  );
}
