import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  getAllApproved,
  getAllPending,
  getAllRejected,
  approveCompetence,
  rejectCompetence,
  assignToOther,
  getMetadata,
  updateCategorization,
  getCompetence,
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
  const [categorizationModalItem, setCategorizationModalItem] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [categorizationLoading, setCategorizationLoading] = useState(false);
  const [categorizationSubmitting, setCategorizationSubmitting] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let data;
      if (status === "pending") data = await getAllPending();
      else if (status === "approved") data = await getAllApproved();
      else data = await getAllRejected();

      setItems(data || []);
    } catch (err) {
      const errorMsg = "Failed to load competences";
      setError(errorMsg);
      showError(err, errorMsg);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setPage(0);
    setExpandedRows(new Set());
    setSelectedItems(new Set());
    localStorage.setItem("reviewStatus", status);
    load();
  }, [status, load]); 

  useEffect(() => {
    localStorage.setItem("reviewPageSize", String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    localStorage.setItem("reviewSortField", sortField);
    localStorage.setItem("reviewSortDirection", sortDirection);
  }, [sortField, sortDirection]);

  // Reset to page 0 when filters or search change
  useEffect(() => {
    setPage(0);
    setSelectedItems(new Set());
  }, [searchQuery, filters.area, filters.category, filters.subcategory, filters.matchedType]);

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

  // Paginate the filtered and sorted items
  const paginatedItems = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return filteredAndSortedItems.slice(start, end);
  }, [filteredAndSortedItems, page, pageSize]);

  // Calculate hasMore based on filtered/sorted items
  const hasMore = useMemo(() => {
    const start = page * pageSize;
    return start + pageSize < filteredAndSortedItems.length;
  }, [filteredAndSortedItems.length, page, pageSize]);

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

    // Check if this is a bulk reject
    if (rejectModalItem.competenceId === null && selectedItems.size > 0) {
      await confirmBulkReject();
      return;
    }

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

  function toggleItemSelection(competenceId) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(competenceId)) {
      newSelected.delete(competenceId);
    } else {
      newSelected.add(competenceId);
    }
    setSelectedItems(newSelected);
  }

  function toggleSelectAll() {
    if (selectedItems.size === paginatedItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(paginatedItems.map(item => item.competenceId)));
    }
  }

  async function handleBulkApprove() {
    if (selectedItems.size === 0) return;
    
    const count = selectedItems.size;
    if (!window.confirm(`Approve ${count} ${count === 1 ? 'competence' : 'competences'}?`)) {
      return;
    }

    setBulkActionLoading(true);
    try {
      const promises = Array.from(selectedItems).map(id =>
        approveCompetence(id, `Bulk approved via UI (${count} items)`)
      );
      await Promise.all(promises);
      showSuccess(`Successfully approved ${count} ${count === 1 ? 'competence' : 'competences'}`);
      setSelectedItems(new Set());
      await load();
    } catch (err) {
      showError(err, `Failed to approve some competences`);
    } finally {
      setBulkActionLoading(false);
    }
  }

  function openBulkRejectModal() {
    if (selectedItems.size === 0) return;
    setRejectNotes("");
    setRejectModalItem({ competenceId: null, name: `${selectedItems.size} competences` });
  }

  async function confirmBulkReject() {
    if (selectedItems.size === 0 || !rejectNotes.trim()) return;

    setRejectSubmitting(true);
    try {
      const count = selectedItems.size;
      const promises = Array.from(selectedItems).map(id =>
        rejectCompetence(id, rejectNotes.trim())
      );
      await Promise.all(promises);
      showSuccess(`Successfully rejected ${count} ${count === 1 ? 'competence' : 'competences'}`);
      setSelectedItems(new Set());
      await load();
      closeRejectModal();
    } catch (err) {
      showError(err, "Failed to reject some competences");
    } finally {
      setRejectSubmitting(false);
    }
  }

  async function openCategorizationModal(item) {
    setCategorizationLoading(true);
    try {
      // Load metadata if not already loaded
      if (!metadata) {
        const meta = await getMetadata();
        setMetadata(meta);
      }
      
      // Get full competence details to get IDs
      const detail = await getCompetence(item.competenceId);
      setCategorizationModalItem(detail);
      setSelectedAreaId(detail.areaId || null);
      setSelectedCategoryId(detail.categoryId || null);
      setSelectedSubcategoryId(detail.subcategoryId || null);
    } catch (err) {
      showError(err, "Failed to load competence details");
    } finally {
      setCategorizationLoading(false);
    }
  }

  function closeCategorizationModal() {
    if (categorizationSubmitting) return;
    setCategorizationModalItem(null);
    setSelectedAreaId(null);
    setSelectedCategoryId(null);
    setSelectedSubcategoryId(null);
  }

  async function confirmCategorizationUpdate() {
    if (!categorizationModalItem || !selectedAreaId) return;

    setCategorizationSubmitting(true);
    try {
      await updateCategorization(
        categorizationModalItem.competenceId,
        selectedAreaId,
        selectedCategoryId,
        selectedSubcategoryId
      );
      showSuccess("Categorization updated successfully");
      await load();
      closeCategorizationModal();
    } catch (err) {
      showError(err, "Failed to update categorization");
    } finally {
      setCategorizationSubmitting(false);
    }
  }

  // Load metadata on mount
  useEffect(() => {
    getMetadata().then(setMetadata).catch(err => {
      console.error("Failed to load metadata:", err);
    });
  }, []);

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

        {status === "pending" && selectedItems.size > 0 && (
          <div className="review-bulk-actions">
            <span className="muted review-bulk-count">
              {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} selected
            </span>
            <button
              className="btn btn-approve btn-sm"
              onClick={handleBulkApprove}
              disabled={bulkActionLoading}
            >
              {bulkActionLoading ? "Approving..." : `Approve ${selectedItems.size}`}
            </button>
            <button
              className="btn btn-reject btn-sm"
              onClick={openBulkRejectModal}
              disabled={bulkActionLoading}
            >
              Reject {selectedItems.size}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedItems(new Set())}
              disabled={bulkActionLoading}
            >
              Clear
            </button>
          </div>
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
            {paginatedItems.map(item => {
              const notes = item.reviewNotes ?? "";

              const isSelected = selectedItems.has(item.competenceId);

              return (
                <div 
                  className={`review-card ${isSelected ? 'review-card-selected' : ''} review-card-clickable`} 
                  key={item.competenceId}
                  onClick={(e) => {
                    // Don't toggle if clicking on buttons or links
                    if (e.target.closest('button') || e.target.closest('a')) return;
                    toggleItemSelection(item.competenceId);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleItemSelection(item.competenceId);
                    }
                  }}
                  aria-label={`Select ${item.name}`}
                >
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
                      <button className="btn btn-sm" onClick={() => openCategorizationModal(item)}>Edit Categorization</button>
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

            {paginatedItems.length === 0 && filteredAndSortedItems.length === 0 && (
              <div className="card">No competences found.</div>
            )}
            {paginatedItems.length === 0 && filteredAndSortedItems.length > 0 && (
              <div className="card">No competences found on this page. Try adjusting filters or going to a different page.</div>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="review-table">
              <thead>
                <tr>
                  {status === "pending" && (
                    <th className="review-table-checkbox-header">
                      <input
                        type="checkbox"
                        checked={paginatedItems.length > 0 && selectedItems.size === paginatedItems.length}
                        onChange={toggleSelectAll}
                        className="review-table-checkbox"
                        aria-label="Select all items on this page"
                        title="Select all on this page"
                      />
                    </th>
                  )}
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
                {paginatedItems.map(item => {
                  const notes = item.reviewNotes ?? "";
                  const isExpanded = expandedRows.has(item.competenceId);
                  const isSelected = status === "pending" && selectedItems.has(item.competenceId);
                  const short = notes.length > 100 ? notes.slice(0, 100) + '…' : notes;
                  
                  return (
                    <tr 
                      key={item.competenceId} 
                      className={`${isExpanded ? "expanded" : ""} ${isSelected ? "review-table-row-selected" : ""} review-table-row-clickable`}
                      onClick={(e) => {
                        // Don't toggle if clicking on buttons, links, or expandable notes
                        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.col-notes.is-clickable')) return;
                        toggleItemSelection(item.competenceId);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleItemSelection(item.competenceId);
                        }
                      }}
                      aria-label={`Select ${item.name}`}
                    >
                      {status === "pending" && (
                        <td className="review-table-checkbox-cell">
                          {isSelected && <span className="review-table-selected-indicator">✓</span>}
                        </td>
                      )}
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
                {paginatedItems.length === 0 && filteredAndSortedItems.length === 0 && (
                  <tr>
                    <td colSpan={status === "pending" ? (status === "approved" || status === "rejected" ? 12 : 11) : (status === "approved" || status === "rejected" ? 11 : 10)}>No competences found.</td>
                  </tr>
                )}
                {paginatedItems.length === 0 && filteredAndSortedItems.length > 0 && (
                  <tr>
                    <td colSpan={status === "pending" ? (status === "approved" || status === "rejected" ? 12 : 11) : (status === "approved" || status === "rejected" ? 11 : 10)}>No competences found on this page. Try adjusting filters or going to a different page.</td>
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
          Showing {paginatedItems.length} of {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'item' : 'items'}
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
                <strong>
                  {rejectModalItem.competenceId === null 
                    ? `${selectedItems.size} competences` 
                    : rejectModalItem.name}
                </strong>{" "}
                so others understand the decision.
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

      {categorizationModalItem && (
        <div className="note-modal-overlay" onClick={closeCategorizationModal} aria-modal="true" role="dialog">
          <div className="note-modal-content" onClick={e => e.stopPropagation()}>
            <div className="note-modal-header">
              <strong>Edit Categorization</strong>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={closeCategorizationModal}
                disabled={categorizationSubmitting}
                aria-label="Close categorization editor"
              >
                Close
              </button>
            </div>
            <div className="note-modal-body">
              {categorizationLoading ? (
                <div className="muted">Loading...</div>
              ) : metadata ? (
                <>
                  <p className="muted" style={{ marginBottom: "1rem" }}>
                    Update the categorization for <strong>{categorizationModalItem.name}</strong>.
                    The competence will remain in pending status.
                  </p>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <label>
                      <strong>Area *</strong>
                      <select
                        className="input"
                        value={selectedAreaId || ""}
                        onChange={(e) => {
                          const newAreaId = e.target.value ? e.target.value : null;
                          setSelectedAreaId(newAreaId);
                          // Reset category and subcategory when area changes
                          setSelectedCategoryId(null);
                          setSelectedSubcategoryId(null);
                        }}
                        disabled={categorizationSubmitting}
                      >
                        <option value="">Select an area...</option>
                        {metadata.areas.map(area => (
                          <option key={area.areaId} value={area.areaId}>{area.name}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <strong>Category</strong>
                      <select
                        className="input"
                        value={selectedCategoryId || ""}
                        onChange={(e) => {
                          const newCategoryId = e.target.value ? e.target.value : null;
                          setSelectedCategoryId(newCategoryId);
                          // Reset subcategory when category changes
                          setSelectedSubcategoryId(null);
                        }}
                        disabled={categorizationSubmitting || !selectedAreaId}
                      >
                        <option value="">None</option>
                        {metadata.categories
                          .filter(cat => cat.areaId === selectedAreaId)
                          .map(category => (
                            <option key={category.categoryId} value={category.categoryId}>{category.name}</option>
                          ))}
                      </select>
                    </label>

                    <label>
                      <strong>Subcategory</strong>
                      <select
                        className="input"
                        value={selectedSubcategoryId || ""}
                        onChange={(e) => {
                          setSelectedSubcategoryId(e.target.value ? e.target.value : null);
                        }}
                        disabled={categorizationSubmitting || !selectedCategoryId}
                      >
                        <option value="">None</option>
                        {metadata.subcategories
                          .filter(sub => sub.categoryId === selectedCategoryId)
                          .map(subcategory => (
                            <option key={subcategory.subcategoryId} value={subcategory.subcategoryId}>{subcategory.name}</option>
                          ))}
                      </select>
                    </label>
                  </div>

                  <div className="actions" style={{ marginTop: "1rem" }}>
                    <button
                      type="button"
                      className="btn btn-approve"
                      onClick={confirmCategorizationUpdate}
                      disabled={categorizationSubmitting || !selectedAreaId}
                    >
                      {categorizationSubmitting ? "Saving…" : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={closeCategorizationModal}
                      disabled={categorizationSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="muted">Loading metadata...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
