import client from "./client";

export async function mapSingle(competence) {
  const res = await client.post("/api/area-mapper/map", { competence });
  return res.data;
}

export async function mapLines(text) {
  const res = await client.post("/api/area-mapper/map-lines", text, {
    headers: { "Content-Type": "text/plain" },
  });
  return res.data;
}
