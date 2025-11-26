import { useState } from "react";
import { mapSingle, mapLines } from "../api/areaMapperApi";

function SingleResultCard({ data }) {
  if (!data) return null;

  const hasError = data && data.errorMessage;
  const response = data && data.response;

  if (hasError && !response) {
    return (
      <div className="map-result map-result-error card">
        <h3>Result</h3>
        <p className="muted">The competence could not be mapped.</p>
        <p className="map-error-message">{data.errorMessage}</p>
      </div>
    );
  }

  if (!response) return null;

  const { input, normalized, area, confidence } = response;
  const percentage = Math.round((confidence ?? 0) * 100);

  return (
    <div className="map-result card">
      <h3>Result</h3>
      <div className="map-result-body">
        <div className="map-result-main">
          <div className="competence-name" title={input}>{input}</div>
          <div className="muted map-result-meta">
            <div><strong>Normalized:</strong> {normalized || "—"}</div>
            <div><strong>Area:</strong> <span className="badge badge-area">{area || "—"}</span></div>
          </div>
        </div>
        <div className="map-result-side">
          <div className="muted map-result-side-label">Confidence</div>
          <div className="confidence-badge">
            <div className="confidence-level">
              <span className="confidence-value">{percentage}%</span>
              <div className="confidence-bar">
                <div
                  className={`confidence-fill ${confidence >= 0.7 ? "confidence-fill-high" : confidence >= 0.4 ? "confidence-fill-medium" : "confidence-fill-low"}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <details className="map-result-raw">
        <summary>View raw response</summary>
        <pre className="result">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

function BatchResultList({ data }) {
  if (!data) return null;

  const results = Array.isArray(data) ? data : data.results || data.Results || [];
  const errors = !Array.isArray(data) ? (data.errors || data.Errors || []) : [];

  if (!results.length && !errors.length) return null;

  return (
    <div className="map-batch card">
      <h3>Batch results</h3>
      {!!errors.length && (
        <div className="map-batch-errors">
          <strong>Errors ({errors.length}):</strong>
          <ul>
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {!!results.length && (
        <div className="map-batch-list">
          {results.map((r, idx) => {
            const percentage = Math.round((r.confidence ?? 0) * 100);
            return (
              <div className="map-batch-item" key={`${r.input}-${idx}`}>
                <div className="map-batch-main">
                  <div className="competence-name" title={r.input}>{r.input}</div>
                  <div className="muted map-batch-meta">
                    <div><strong>Normalized:</strong> {r.normalized || "—"}</div>
                    <div><strong>Area:</strong> <span className="badge badge-area">{r.area || "—"}</span></div>
                  </div>
                </div>
                <div className="map-batch-side">
                  <span className="muted map-batch-side-label">Conf.</span>
                  <span className="map-batch-side-value">{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  const [input, setInput] = useState("");
  const [multiInput, setMultiInput] = useState("");
  const [result, setResult] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleMultiSubmit(e) {
    e.preventDefault();
    if (!multiInput.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await mapLines(multiInput);
      setBatchResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to map lines. Please try again.");
      setBatchResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page map-page">
      <h1>Map competences</h1>

      {error && (
        <div className="card map-error-card">
          <strong className="map-error-title">Error</strong>
          <p className="muted map-error-text">{error}</p>
        </div>
      )}

      <div className="map-grid">
        <section className="card map-card">
          <h2>Map competences (one per line)</h2>
          <form onSubmit={handleMultiSubmit}>
            <textarea
              className="input"
              rows={8}
              value={multiInput}
              onChange={e => setMultiInput(e.target.value)}
              placeholder={"One competence per line…\n.NET\nC#\nProject Management\n…"}
            />
            <div className="map-actions-row">
              <button className="btn btn-approve" type="submit" disabled={loading}>
                {loading ? "Mapping…" : "Map competences"}
              </button>
            </div>
          </form>

          {loading && (
            <p className="muted map-loading-text">Running LLM mapping for all lines…</p>
          )}

          {!loading && batchResult && <BatchResultList data={batchResult} />}
        </section>
      </div>
    </div>
  );
}
