import { useEffect, useState } from "react";
import {
  getPending,
  getApproved,
  getRejected,
  approveCompetence,
  rejectCompetence,
  assignToOther,
} from "../api/reviewApi";

const TABS = ["pending", "approved", "rejected"];

export default function ReviewPage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [hasMore, setHasMore] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(p = page, size = pageSize) {
    setLoading(true);
    setError("");
    try {
      const skip = p * size;
      let data;
      if (status === "pending") data = await getPending(skip, size);
      else if (status === "approved") data = await getApproved(skip, size);
      else data = await getRejected(skip, size);

      setItems(data || []);
      // If API returns fewer items than requested, assume no more pages
      setHasMore((data && data.length) >= size);
    } catch (err) {
      console.error(err);
      setError("Failed to load competences");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // reset to first page when tab changes
    setPage(0);
  }, [status]);

  useEffect(() => {
    load(page, pageSize);
  }, [status, page, pageSize]);

  async function handleApprove(item) {
    try {
      await approveCompetence(item.competenceId, "Approved via UI");
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to approve competence");
    }
  }

  async function handleReject(item) {
    const notes = window.prompt("Rejection notes:");
    if (!notes) return;

    try {
      await rejectCompetence(item.competenceId, notes);
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to reject competence");
    }
  }

  async function handleAssignOther(item) {
    try {
      await assignToOther(item.competenceId, "Assigned to Other via UI");
      await load();
    } catch (err) {
      console.error(err);
      alert("Failed to assign competence to Other");
    }
  }

  return (
    <div className="page review-page">
      <h1>Review competences</h1>

      <div style={{ marginBottom: "1rem" }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setStatus(t)}
            className={`btn btn-tab-${t} ${status === t ? 'active' : ''}`}
            style={{
              marginRight: "0.5rem",
              padding: "0.5rem 1rem",
            }}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        status === 'pending' ? (
          <div className="review-cards">
            {items.map(item => {
              const notes = item.reviewNotes ?? item.notes ?? (item.review && item.review.notes) ?? "";
              const short = typeof notes === 'string' && notes.length > 300 ? notes.slice(0, 300) + '…' : notes;
              return (
                <div className="review-card" key={item.competenceId}>
                  <div className="card-left card">
                    <div className="competence-name">{item.name}</div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      <div>Area: <strong>{item.areaName ?? '—'}</strong></div>
                      <div>Category: <strong>{item.categoryName ?? '—'}</strong></div>
                      <div>Subcategory: <strong>{item.subcategoryName ?? item.subCategory ?? item.subcategory ?? item.subCategoryName ?? '—'}</strong></div>
                      <div>Confidence: <strong>{item.confidence?.toFixed?.(2) ?? '—'}</strong></div>
                    </div>
                    <div className="actions" style={{ marginTop: 10 }}>
                      <button className="btn btn-approve" onClick={() => handleApprove(item)}>Approve</button>
                      <button className="btn btn-reject" onClick={() => handleReject(item)}>Reject</button>
                      <button className="btn btn-other" onClick={() => handleAssignOther(item)}>Other</button>
                    </div>
                  </div>
                  <div className="card-right card">
                    <div
                      className="muted col-notes"
                      title={typeof notes === 'string' ? notes : JSON.stringify(notes)}
                      onClick={() => { if (notes) setSelectedNote(typeof notes === 'string' ? notes : JSON.stringify(notes)); }}
                      style={{ cursor: notes ? 'pointer' : 'default' }}
                    >
                      {short || <span className="muted">—</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="card">No competences found.</div>
            )}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Area</th>
                <th className="col-notes">Review Notes</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.competenceId}>
                  <td className="competence-name">{item.name}</td>
                  <td>{item.areaName}</td>
                  {
                    (() => {
                      const notes = item.reviewNotes ?? item.notes ?? (item.review && item.review.notes) ?? "";
                      const short = typeof notes === 'string' && notes.length > 140 ? notes.slice(0, 140) + '…' : notes;
                      return (
                        <td className="muted col-notes" title={typeof notes === 'string' ? notes : JSON.stringify(notes)}>
                          {short || <span className="muted">—</span>}
                        </td>
                      );
                    })()
                  }
                  <td>{item.categoryName}</td>
                  <td>{item.subcategoryName ?? item.subCategory ?? item.subcategory ?? item.subCategoryName ?? <span className="muted">—</span>}</td>
                  <td>{item.confidence?.toFixed?.(2)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6}>No competences found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )
      )}

      {/* Pagination controls */}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button className="btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>Prev</button>
        <span className="muted">Page {page + 1}</span>
        <button className="btn" onClick={() => { if (hasMore) setPage(p => p + 1); }} disabled={!hasMore || loading}>Next</button>
        <div style={{ marginLeft: 'auto' }}>
          <span className="muted">Per page: 5</span>
        </div>
      </div>

      {/* Notes modal */}
      {selectedNote && (
        <div className="note-modal-overlay" onClick={() => setSelectedNote(null)}>
          <div className="note-modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Review Notes</strong>
              <button className="btn" onClick={() => setSelectedNote(null)}>Close</button>
            </div>
            <div style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{selectedNote}</div>
          </div>
        </div>
      )}
    </div>
  );
}
