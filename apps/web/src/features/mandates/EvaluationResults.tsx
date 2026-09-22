import type { ApiEnvelope, ConstraintFinding, Evaluation } from "@portfolio-atlas/contracts";

const titles = {
  satisfied: "The allocation meets this mandate.",
  breached: "A limit needs your attention.",
  invalid: "Fix the allocation or policy first.",
  not_evaluable: "More information is needed.",
};
const badges = {
  satisfied: "Satisfied",
  breached: "Breached",
  invalid: "Invalid",
  not_evaluable: "Not evaluable",
};
function value(number: number | null, unit: ConstraintFinding["unit"]) {
  return number === null
    ? "—"
    : unit === "weight"
      ? Number((number * 100).toFixed(2)) + "%"
      : String(number);
}
export function EvaluationResults({ response }: { response: ApiEnvelope<Evaluation> | null }) {
  if (!response)
    return (
      <div className="empty-results">
        <span className="empty-symbol" aria-hidden="true">
          ≋
        </span>
        <div>
          <h3>Every decision deserves a reason.</h3>
          <p>
            Save your mandate, then check an allocation. The API will return each rule, its limit
            and an explanation.
          </p>
        </div>
      </div>
    );
  const { data: evaluation, metadata, requestId } = response;
  const result = evaluation.result;
  return (
    <div>
      <div className={"verdict verdict-" + result.status} role="status">
        <div>
          <span className={"badge " + result.status}>{badges[result.status]}</span>
          <h3>{titles[result.status]}</h3>
        </div>
        <span className="finding-count">
          {result.findings.filter((f) => f.status === "pass").length} / {result.findings.length}
          <small>checks passed</small>
        </span>
      </div>
      <p className="results-note">
        Observed values are compared with inclusive limits. Known sector totals cover classified
        holdings only; missing classifications prevent a complete verdict.
      </p>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">Server evaluation findings</caption>
          <thead>
            <tr>
              <th scope="col">Rule / subject</th>
              <th scope="col">Observed</th>
              <th scope="col">Limit</th>
              <th scope="col">Result & reason</th>
            </tr>
          </thead>
          <tbody>
            {result.findings.map((finding, index) => (
              <tr key={index} className={"finding-" + finding.status}>
                <th scope="row">
                  {finding.rule}
                  <small>{finding.subject}</small>
                </th>
                <td>{value(finding.observed, finding.unit)}</td>
                <td>
                  {finding.comparison === "at_least"
                    ? "≥ "
                    : finding.comparison === "at_most"
                      ? "≤ "
                      : finding.comparison === "equal"
                        ? "= "
                        : ""}
                  {value(finding.limit, finding.unit)}
                </td>
                <td>
                  <span className={"finding-status " + finding.status}>
                    {finding.status === "pass"
                      ? "Pass"
                      : finding.status === "fail"
                        ? "Fail"
                        : "Not evaluable"}
                  </span>
                  <p>{finding.explanation}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="provenance">
        <summary>Inspect evaluation provenance</summary>
        <dl>
          <dt>Mandate revision</dt>
          <dd>{evaluation.mandateRevision}</dd>
          <dt>Policy definition</dt>
          <dd>{evaluation.policyVersion}</dd>
          <dt>Allocation as of</dt>
          <dd>{evaluation.allocation.asOf}</dd>
          <dt>Evaluated at</dt>
          <dd>{evaluation.evaluatedAt}</dd>
          <dt>Evaluation ID</dt>
          <dd>{evaluation.id}</dd>
          <dt>Request ID</dt>
          <dd>{requestId}</dd>
          <dt>Session</dt>
          <dd>{metadata.sessionId}</dd>
        </dl>
      </details>
    </div>
  );
}
