import client from "./client";

export async function login(username, password) {
  const res = await client.post("/api/auth/login", {
    username,
    password,
  });
  return res.data;
}

