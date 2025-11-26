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

export async function getRejected(skip = 0, take = 50) {
  const res = await client.get("/api/review/rejected", {
    params: { skip, take },
  });
  return res.data;
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
