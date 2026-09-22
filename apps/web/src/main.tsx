import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WorkspaceRouter } from "./app/WorkspaceRouter";
import "./app/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WorkspaceRouter />
  </StrictMode>,
);
import "./features/instruments/instruments.css";
