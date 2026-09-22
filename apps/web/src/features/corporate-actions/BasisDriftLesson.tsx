import { useEffect, useState } from "react";
import { basisDriftReportSchema, type BasisDriftReport } from "@portfolio-atlas/contracts";
import { read } from "../../shared/api";
export function BasisDriftLesson() {
  const [report, setReport] = useState<BasisDriftReport | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    read("/corporate-actions/basis-drift-lesson", basisDriftReportSchema, abort.signal)
      .then((result) => setReport(result.data))
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  return (
    <section className="chapter-panel">
      <h2>04 / Did the archived price basis change?</h2>
      <p className="chapter-muted">
        Independent synthetic comparison: two archived snapshots, one newly known 2-for-1 split, and
        one deliberately unexplained change.
      </p>
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <p className="chapter-warning">
            Archive diagnosis: {report.state}. Tolerance: {report.toleranceBps} basis point.
          </p>
          <div className="chapter-table-wrap" tabIndex={0} aria-label="Basis drift comparison">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Old factor</th>
                  <th>New factor</th>
                  <th>Expected multiplier</th>
                  <th>Residual bps</th>
                  <th>Diagnosis</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{row.oldFactor}</td>
                    <td>{row.newFactor}</td>
                    <td>{row.expectedMultiplier}</td>
                    <td>{row.residualBps}</td>
                    <td>{row.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="chapter-muted">
            Baseline observed {report.baselineObservedAt}. Candidate observed{" "}
            {report.candidateObservedAt}.
          </p>
          {report.limitations.map((reason) => (
            <p className="chapter-muted" key={reason}>
              {reason}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
