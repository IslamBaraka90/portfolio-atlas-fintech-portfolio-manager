import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";

function FoundationScreen() {
  const [message, setMessage] = useState("Connecting to the local API…");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/v1/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then(() => setMessage("API connected · Synthetic data · Session-only storage"))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(String(error));
      });
    return () => controller.abort();
  }, []);
  return (
    <main>
      <p>Portfolio Atlas / Chapter 01</p>
      <h1>Start with a mandate.</h1>
      <p>{message}</p>
      <p>The connected mandate editor arrives in task 5.</p>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FoundationScreen />
  </StrictMode>,
);
