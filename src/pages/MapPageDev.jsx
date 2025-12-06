import { useState } from "react";
import { mapLines } from "../api/areaMapperApi";
import { SkeletonCard } from "../components/SkeletonLoader";
import { showError, showSuccess } from "../utils/errorHandler";
import { parseErrorMessage, extractErrorMessages, extractErrorsFromResponse } from "../utils/mappingErrorParser";

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
              <li key={idx}>{parseErrorMessage(err)}</li>
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
                    <span className="muted map-batch-side-label">Confidence</span>
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
  const [multiInput, setMultiInput] = useState("");
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorMessages, setErrorMessages] = useState([]);

  async function handleMultiSubmit(e) {
    e.preventDefault();
    if (!multiInput.trim()) return;
    setLoading(true);
    setError("");
    setErrorMessages([]);
    try {
      const data = await mapLines(multiInput);
      
      // Check if response contains errors (207 Multi-Status)
      const parsedErrors = extractErrorsFromResponse(data);
      
      if (parsedErrors.length > 0) {
        // Partial success - some succeeded, some failed
        setErrorMessages(parsedErrors);
        setBatchResult(data);
        
        const results = Array.isArray(data) ? data : data.results || data.Results || [];
        if (results.length > 0) {
          showSuccess(`${results.length} competences mapped successfully, but ${parsedErrors.length} failed`);
        } else {
          showError(null, `${parsedErrors.length} competences failed to map`);
        }
      } else {
        // All succeeded
        setBatchResult(data);
        const results = Array.isArray(data) ? data : data.results || data.Results || [];
        showSuccess(`${results.length} competences mapped successfully`);
      }
    } catch (err) {
      // Extract specific error messages from the error response
      const extractedErrors = extractErrorMessages(err);
      
      if (extractedErrors.length > 0) {
        setErrorMessages(extractedErrors);
        // Show first error as the main error message
        setError(extractedErrors.length === 1 ? extractedErrors[0] : `${extractedErrors.length} errors occurred`);
        showError(err, extractedErrors.length === 1 ? extractedErrors[0] : `${extractedErrors.length} errors occurred`);
      } else {
        // Fallback to generic message if we can't extract specific errors
        const errorMsg = "Failed to map lines. Please try again.";
        setError(errorMsg);
        showError(err, errorMsg);
      }
      setBatchResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page map-page">
      <h1>Map competences</h1>
      {(error || errorMessages.length > 0) && (
        <div className="card map-error-card">
          <strong className="map-error-title">Error{errorMessages.length > 1 ? "s" : ""}</strong>
          {errorMessages.length > 0 ? (
            <div className="map-error-messages">
              {errorMessages.length === 1 ? (
                <p className="muted map-error-text">{errorMessages[0]}</p>
              ) : (
                <ul className="map-error-list">
                  {errorMessages.map((msg, idx) => (
                    <li key={idx} className="muted map-error-text">{msg}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="muted map-error-text">{error}</p>
          )}
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
            <div>
              <p className="muted map-loading-text">Running LLM mapping for all lines...</p>
              <SkeletonCard />
            </div>
          )}

          {!loading && batchResult && <BatchResultList data={batchResult} />}
        </section>
      </div>
    </div>
  );
}
