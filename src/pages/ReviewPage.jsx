import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  getPending,
  getApproved,
  getRejected,
  getAllApproved,
  approveCompetence,
  rejectCompetence,
  assignToOther,
} from "../api/reviewApi";
import { SkeletonCard, SkeletonTable } from "../components/SkeletonLoader";
import { showError, showSuccess } from "../utils/errorHandler";

const TABS = ["pending", "approved", "rejected"];

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function formatDateFull(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return <span className="muted">—</span>;
  
  const level = confidence >= 0.7 ? "high" : confidence >= 0.4 ? "medium" : "low";
  const percentage = Math.round(confidence * 100);
  
  return (
    <div className="confidence-badge">
      <div className={`confidence-level confidence-${level}`}>
        <span className="confidence-value">{percentage}%</span>
        <div className="confidence-bar">
          <div 
            className={`confidence-fill confidence-fill-${level}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const statusMap = {
    "PendingReview": { label: "Pending", class: "status-pending" },
    "Approved": { label: "Approved", class: "status-approved" },
    "Rejected": { label: "Rejected", class: "status-rejected" },
  };
  
  const statusInfo = statusMap[status] || { label: status, class: "status-unknown" };
  
  return <span className={`status-badge ${statusInfo.class}`}>{statusInfo.label}</span>;
}

export default function ReviewPage() {
  const [status, setStatus] = useState(() => {
    return localStorage.getItem("reviewStatus") || "pending";
  });
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const stored = localStorage.getItem("reviewPageSize");
    return stored ? Number(stored) : 10;
  });
  const [hasMore, setHasMore] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState(() => {
    return localStorage.getItem("reviewSortField") || "createdAt";
  });
  const [sortDirection, setSortDirection] = useState(() => {
    return localStorage.getItem("reviewSortDirection") || "desc";
  });
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    area: "",
    category: "",
    subcategory: "",
    matchedType: "",
  });
  const [rejectModalItem, setRejectModalItem] = useState(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const load = useCallback(async (p = page, size = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const skip = p * size;
      let data;
      if (status === "pending") data = await getPending(skip, size);
      else if (status === "approved") data = await getApproved(skip, size);
      else data = await getRejected(skip, size);

      setItems(data || []);
      setHasMore((data && data.length) >= size);
    } catch (err) {
      const errorMsg = "Failed to load competences";
      setError(errorMsg);
      showError(err, errorMsg);
    } finally {
      setLoading(false);
    }
  }, [status, page, pageSize]);

  useEffect(() => {
    setPage(0);
    setExpandedRows(new Set());
    localStorage.setItem("reviewStatus", status);
  }, [status]);

  useEffect(() => {
    load(page, pageSize);
  }, [status, page, pageSize, load]); 

  useEffect(() => {
    localStorage.setItem("reviewPageSize", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    localStorage.setItem("reviewSortField", sortField);
    localStorage.setItem("reviewSortDirection", sortDirection);
  }, [sortField, sortDirection]);

  const filteredAndSortedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = items.filter(item => {
      const matchesSearch =
        !q ||
        (item.name || "").toLowerCase().includes(q) ||
        (item.normalized || "").toLowerCase().includes(q);

      const matchesArea = !filters.area || item.areaName === filters.area;
      const matchesCategory = !filters.category || item.categoryName === filters.category;
      const matchesSubcategory = !filters.subcategory || item.subcategoryName === filters.subcategory;
      const matchesMatchedType = !filters.matchedType || item.matchedType === filters.matchedType;

      return matchesSearch && matchesArea && matchesCategory && matchesSubcategory && matchesMatchedType;
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "confidence":
          aVal = a.confidence ?? 0;
          bVal = b.confidence ?? 0;
          break;
        case "createdAt":
          aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        case "area":
          aVal = (a.areaName || "").toLowerCase();
          bVal = (b.areaName || "").toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [items, sortField, sortDirection, searchQuery, filters]);

  const uniqueFilterValues = useMemo(() => {
    const areas = new Set();
    const categories = new Set();
    const subcategories = new Set();
    const matchedTypes = new Set();

    items.forEach(i => {
      if (i.areaName) areas.add(i.areaName);
      if (i.categoryName) categories.add(i.categoryName);
      if (i.subcategoryName) subcategories.add(i.subcategoryName);
      if (i.matchedType) matchedTypes.add(i.matchedType);
    });

    return {
      areas: Array.from(areas).sort(),
      categories: Array.from(categories).sort(),
      subcategories: Array.from(subcategories).sort(),
      matchedTypes: Array.from(matchedTypes).sort(),
    };
  }, [items]);

  const pendingCount = useMemo(
    () => (status === "pending" ? filteredAndSortedItems.length : 0),
    [status, filteredAndSortedItems]
  );
  const approvedCount = useMemo(
    () => (status === "approved" ? filteredAndSortedItems.length : 0),
    [status, filteredAndSortedItems]
  );
  const rejectedCount = useMemo(
    () => (status === "rejected" ? filteredAndSortedItems.length : 0),
    [status, filteredAndSortedItems]
  );
  const averageConfidence = useMemo(() => {
    if (!filteredAndSortedItems.length) return null;
    const vals = filteredAndSortedItems
      .map(i => i.confidence)
      .filter(c => c != null);
    if (!vals.length) return null;
    const sum = vals.reduce((acc, c) => acc + c, 0);
    return sum / vals.length;
  }, [filteredAndSortedItems]);

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  }

  function toggleRow(competenceId) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(competenceId)) {
      newExpanded.delete(competenceId);
    } else {
      newExpanded.add(competenceId);
    }
    setExpandedRows(newExpanded);
  }

  async function handleApprove(item) {
    try {
      await approveCompetence(item.competenceId, "Approved via UI");
      showSuccess("Competence approved successfully");
      await load();
    } catch (err) {
      showError(err, "Failed to approve competence");
    }
  }

  function openRejectModal(item) {
    setRejectModalItem(item);
    setRejectNotes("");
  }

  function closeRejectModal() {
    if (rejectSubmitting) return;
    setRejectModalItem(null);
    setRejectNotes("");
  }

  async function confirmReject() {
    if (!rejectModalItem || !rejectNotes.trim()) return;

    setRejectSubmitting(true);
    try {
      await rejectCompetence(rejectModalItem.competenceId, rejectNotes.trim());
      showSuccess("Competence rejected successfully");
      await load();
      closeRejectModal();
    } catch (err) {
      showError(err, "Failed to reject competence");
    } finally {
      setRejectSubmitting(false);
    }
  }

  async function handleAssignOther(item) {
    try {
      await assignToOther(item.competenceId, "Assigned to Other via UI");
      showSuccess("Competence assigned to 'Other' area successfully");
      await load();
    } catch (err) {
      showError(err, "Failed to assign competence to Other");
    }
  }

  async function handleDownloadExcel() {
    setExportLoading(true);
    try {
      const allCompetences = await getAllApproved();

      const excelData = allCompetences.map(item => ({
        Name: item.name || "",
        Area: item.areaName || "",
        Category: item.categoryName || "",
        Subcategory: item.subcategoryName || "",
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Approved Competences");

      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const filename = `approved-competences-${dateStr}.xlsx`;

      XLSX.writeFile(wb, filename);
      showSuccess("Excel file downloaded successfully");
    } catch (err) {
      showError(err, "Failed to export competences to Excel");
    } finally {
      setExportLoading(false);
    }
  }

  function SortableHeader({ field, children }) {
    const isActive = sortField === field;
    return (
      <th 
        className={`sortable ${isActive ? "active" : ""}`}
        onClick={() => handleSort(field)}
      >
        {children}
        {isActive && (
          <span className="sort-indicator">
            {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        )}
      </th>
    );
  }

  return (
    <div className="page review-page">
      <h1>Review Competences</h1>

      <div className="review-dashboard">
        <div className="card review-kpi-card">
          <div className="review-kpi-label">Pending (this view)</div>
          <div className="review-kpi-value">{pendingCount}</div>
        </div>
        <div className="card review-kpi-card">
          <div className="review-kpi-label">Approved (this view)</div>
          <div className="review-kpi-value">{approvedCount}</div>
        </div>
        <div className="card review-kpi-card">
          <div className="review-kpi-label">Rejected (this view)</div>
          <div className="review-kpi-value">{rejectedCount}</div>
        </div>
        <div className="card review-kpi-card">
          <div className="review-kpi-label">Avg. confidence</div>
          <div className="review-kpi-value">
            {averageConfidence == null ? "—" : `${Math.round(averageConfidence * 100)}%`}
          </div>
        </div>
      </div>

      <div className="review-toolbar">
        <div className="review-tabs">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setStatus(t)}
              className={`btn btn-tab-${t} ${status === t ? 'active' : ''} review-tab-button`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="review-search">
          <input
            type="search"
            className="input review-search-input"
            placeholder="Search by name or normalized…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="review-filters muted">
          <label>
            Area
            <select
              value={filters.area}
              onChange={e => setFilters(prev => ({ ...prev, area: e.target.value }))}
            >
              <option value="">All</option>
              {uniqueFilterValues.areas.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select
              value={filters.category}
              onChange={e => setFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All</option>
              {uniqueFilterValues.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Subcategory
            <select
              value={filters.subcategory}
              onChange={e => setFilters(prev => ({ ...prev, subcategory: e.target.value }))}
            >
              <option value="">All</option>
              {uniqueFilterValues.subcategories.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Matched
            <select
              value={filters.matchedType}
              onChange={e => setFilters(prev => ({ ...prev, matchedType: e.target.value }))}
            >
              <option value="">All</option>
              {uniqueFilterValues.matchedTypes.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="review-page-size">
          <label className="muted review-page-size-label">
            Page size:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="review-page-size-select"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>

        {status === "approved" && (
          <button
            className="btn btn-approve"
            onClick={handleDownloadExcel}
            disabled={exportLoading}
          >
            {exportLoading ? "Exporting..." : "Download Excel"}
          </button>
        )}
      </div>

      {error && <p className="review-error-text">{error}</p>}

      {loading && (
        status === 'pending' ? (
          <div className="review-cards">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <SkeletonTable rows={5} columns={status === "approved" || status === "rejected" ? 11 : 10} />
        )
      )}

      {!loading && !error && (
        status === 'pending' ? (
          <div className="review-cards">
            {filteredAndSortedItems.map(item => {
              const notes = item.reviewNotes ?? "";

              return (
                <div className="review-card" key={item.competenceId}>
                  <div className="card-left card">
                    <div>
                      <div className="competence-name">{item.name}</div>
                      <div className="muted review-card-meta">
                        <div><strong>Normalized:</strong> {item.normalized || "—"}</div>
                        <div><strong>Area:</strong> {item.areaName ?? '—'}</div>
                        <div><strong>Category:</strong> {item.categoryName ?? '—'}</div>
                        <div><strong>Subcategory:</strong> {item.subcategoryName ?? '—'}</div>
                        <div><strong>Matched Type:</strong> {item.matchedType ?? '—'}</div>
                        <div className="review-card-meta-row">
                          <strong>Confidence:</strong> <ConfidenceBadge confidence={item.confidence} />
                        </div>
                        <div className="review-card-meta-row">
                          <strong>Created:</strong> <span title={formatDateFull(item.createdAt)}>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="actions review-card-actions">
                      <button className="btn btn-approve" onClick={() => handleApprove(item)}>Approve</button>
                      <button className="btn btn-reject" onClick={() => openRejectModal(item)}>Reject</button>
                      <button className="btn btn-other" onClick={() => handleAssignOther(item)}>Other</button>
                    </div>
                  </div>
                  <div className="card-right card review-card-notes">
                    <div className="muted review-card-notes-text">
                      <strong>Review Notes:</strong>
                      <div
                        className={`col-notes review-card-notes-body ${notes ? "is-clickable" : ""}`}
                        onClick={() => notes && setSelectedNote(notes)}
                        title={notes ? "Click to view full notes" : ""}
                      >
                        {notes || <span className="muted">—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredAndSortedItems.length === 0 && (
              <div className="card">No competences found.</div>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="review-table">
              <thead>
                <tr>
                  <SortableHeader field="name">Name</SortableHeader>
                  <th>Normalized</th>
                  <SortableHeader field="area">Area</SortableHeader>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Matched Type</th>
                  <SortableHeader field="confidence">Confidence</SortableHeader>
                  <SortableHeader field="createdAt">Created</SortableHeader>
                  {status === "approved" && <th>Reviewed</th>}
                  {status === "rejected" && <th>Reviewed</th>}
                  <th className="col-notes">Review Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedItems.map(item => {
                  const notes = item.reviewNotes ?? "";
                  const isExpanded = expandedRows.has(item.competenceId);
                  const short = notes.length > 100 ? notes.slice(0, 100) + '…' : notes;
                  
                  return (
                    <tr key={item.competenceId} className={isExpanded ? "expanded" : ""}>
                      <td className="competence-name">{item.name}</td>
                      <td className="muted review-table-cell-small">{item.normalized || "—"}</td>
                      <td>{item.areaName || "—"}</td>
                      <td>{item.categoryName || "—"}</td>
                      <td>{item.subcategoryName || "—"}</td>
                      <td className="muted review-table-cell-small">{item.matchedType || "—"}</td>
                      <td><ConfidenceBadge confidence={item.confidence} /></td>
                      <td className="muted review-table-cell-small" title={formatDateFull(item.createdAt)}>
                        {formatDate(item.createdAt)}
                      </td>
                      {(status === "approved" || status === "rejected") && (
                        <td className="muted review-table-cell-small">
                          {item.reviewedAt ? (
                            <span title={formatDateFull(item.reviewedAt)}>{formatDate(item.reviewedAt)}</span>
                          ) : "—"}
                        </td>
                      )}
                      <td 
                        className={`muted col-notes review-table-notes ${isExpanded ? "expanded" : ""} ${notes ? "is-clickable" : ""}`}
                        onClick={() => notes && toggleRow(item.competenceId)}
                        title={notes ? (isExpanded ? "Click to collapse" : "Click to expand") : ""}
                      >
                        {notes ? (isExpanded ? notes : short) : <span className="muted">—</span>}
                        {notes && notes.length > 100 && (
                          <span className="expand-hint">
                            {isExpanded ? " [collapse]" : " [expand]"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredAndSortedItems.length === 0 && (
                  <tr>
                    <td colSpan={status === "approved" || status === "rejected" ? 11 : 10}>No competences found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}

      <div className="review-pagination">
        <button 
          className="btn" 
          onClick={() => setPage(p => Math.max(0, p - 1))} 
          disabled={page === 0 || loading}
        >
          Previous
        </button>
        <span className="muted review-pagination-page">Page {page + 1}</span>
        <button 
          className="btn" 
          onClick={() => { if (hasMore) setPage(p => p + 1); }} 
          disabled={!hasMore || loading}
        >
          Next
        </button>
        <span className="muted review-pagination-summary">
          Showing {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {selectedNote && (
        <div className="note-modal-overlay" onClick={() => setSelectedNote(null)}>
          <div className="note-modal-content" onClick={e => e.stopPropagation()}>
            <div className="note-modal-header">
              <strong>Review Notes</strong>
              <button className="btn" onClick={() => setSelectedNote(null)}>Close</button>
            </div>
            <div className="note-modal-body">{selectedNote}</div>
          </div>
        </div>
      )}

      {rejectModalItem && (
        <div className="note-modal-overlay" onClick={closeRejectModal} aria-modal="true" role="dialog">
          <div className="note-modal-content" onClick={e => e.stopPropagation()}>
            <div className="note-modal-header">
              <strong>Reject competence</strong>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={closeRejectModal}
                disabled={rejectSubmitting}
                aria-label="Close reject dialog"
              >
                Close
              </button>
            </div>
            <div className="note-modal-body">
              <p className="muted">
                Please provide a short explanation for rejecting{" "}
                <strong>{rejectModalItem.name}</strong> so others understand the decision.
              </p>
              <textarea
                className="input"
                rows={4}
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Example: Overlaps with existing competence in Area X / Not relevant for this program / Too generic…"
              />
              <div className="actions" style={{ marginTop: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-reject"
                  onClick={confirmReject}
                  disabled={rejectSubmitting || !rejectNotes.trim()}
                >
                  {rejectSubmitting ? "Rejecting…" : "Confirm reject"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={closeRejectModal}
                  disabled={rejectSubmitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="review-loading-overlay" aria-hidden="true">
          <div className="review-loading-spinner" />
          <div className="review-loading-text muted">Loading competences…</div>
        </div>
      )}
    </div>
  );
}
