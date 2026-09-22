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
  return hash === "#market-data" ? (
    <DataQualityDesk />
  ) : hash === "#instruments" ? (
    <InstrumentExplorer />
  ) : (
    <App />
  );
}
