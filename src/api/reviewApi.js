import client from "./client";

// GET /api/review/pending?skip=&take=
export async function getPending(skip = 0, take = 50) {
  const res = await client.get("/api/review/pending", {
    params: { skip, take },
  });
  return res.data;
}

export async function getApproved(skip = 0, take = 50) {
  const res = await client.get("/api/review/Approved", { params: { skip, take } });
  return res.data;
}

// Get all approved competences in batches
export async function getAllApproved() {
  const allCompetences = [];
  let skip = 0;
  const take = 5000;
  let hasMore = true;

  while (hasMore) {
    const batch = await getApproved(skip, take);
    if (batch && batch.length > 0) {
      allCompetences.push(...batch);
      skip += batch.length;
      hasMore = batch.length === take;
    } else {
      hasMore = false;
    }
  }

  return allCompetences;
}

export async function getRejected(skip = 0, take = 50) {
  const res = await client.get("/api/review/rejected", {
    params: { skip, take },
  });
  return res.data;
}

// Get all pending competences in batches
export async function getAllPending() {
  const allCompetences = [];
  let skip = 0;
  const take = 5000;
  let hasMore = true;

  while (hasMore) {
    const batch = await getPending(skip, take);
    if (batch && batch.length > 0) {
      allCompetences.push(...batch);
      skip += batch.length;
      hasMore = batch.length === take;
    } else {
      hasMore = false;
    }
  }

  return allCompetences;
}

// Get all rejected competences in batches
export async function getAllRejected() {
  const allCompetences = [];
  let skip = 0;
  const take = 5000;
  let hasMore = true;

  while (hasMore) {
    const batch = await getRejected(skip, take);
    if (batch && batch.length > 0) {
      allCompetences.push(...batch);
      skip += batch.length;
      hasMore = batch.length === take;
    } else {
      hasMore = false;
    }
  }

  return allCompetences;
}

// GET /api/review/{id}
export async function getCompetence(id) {
  const res = await client.get(`/api/review/${id}`);
  return res.data;
}

// POST /api/review/{id}/approve
export async function approveCompetence(id, reviewNotes) {
  const res = await client.post(`/api/review/${id}/approve`, {
    reviewNotes,
  });
  return res.data;
}

// POST /api/review/{id}/reject
export async function rejectCompetence(id, reviewNotes) {
  const res = await client.post(`/api/review/${id}/reject`, {
    reviewNotes,
  });
  return res.data;
}

// POST /api/review/{id}/assign-other
export async function assignToOther(id, reviewNotes) {
  const res = await client.post(`/api/review/${id}/assign-other`, {
    reviewNotes,
  });
  return res.data;
}

// GET /api/review/metadata
export async function getMetadata() {
  const res = await client.get("/api/review/metadata");
  return res.data;
}

// PATCH /api/review/{id}/update-categorization
export async function updateCategorization(competenceId, areaId, categoryId, subcategoryId) {
  const res = await client.patch(`/api/review/${competenceId}/update-categorization`, {
    areaId,
    categoryId: categoryId || null,
    subcategoryId: subcategoryId || null,
  });
  return res.data;
}
