import { readBearerToken, verifyFirebaseIdToken } from "./firebase-auth.js";

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

async function authenticate(request, env) {
  const token = readBearerToken(request);
  if (!token) return { error: json({ error: "unauthenticated" }, 401) };

  try {
    const claims = await verifyFirebaseIdToken(token, {
      projectId: env.FIREBASE_PROJECT_ID,
    });
    return { claims };
  } catch {
    return { error: json({ error: "unauthenticated" }, 401) };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        service: "sandwichies-worker",
        status: "ok",
        stage: "foundation",
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/session") {
      const auth = await authenticate(request, env);
      if (auth.error) return auth.error;
      return json({
        uid: auth.claims.sub,
        authenticated: true,
        admin: auth.claims.admin === true,
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/session") {
      const auth = await authenticate(request, env);
      if (auth.error) return auth.error;
      if (auth.claims.admin !== true) {
        return json({ error: "permission-denied" }, 403);
      }
      return json({ uid: auth.claims.sub, admin: true });
    }

    return json({ error: "not-found" }, 404);
  },
};
