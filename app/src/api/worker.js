const workerBaseUrl = String(import.meta.env.VITE_SANDWICHIES_WORKER_URL || "").trim().replace(/\\/+$/, "");

export async function workerRequest(path, {
  auth,
  method = "GET",
  body,
} = {}) {
  if (!workerBaseUrl) {
    throw new Error("El backend Worker aún no está configurado. Define VITE_SANDWICHIES_WORKER_URL antes de habilitar esta función.");
  }
  const user = auth?.currentUser;
  if (!user) throw new Error("Inicia sesión antes de continuar.");
  const token = await user.getIdToken();
  const response = await fetch(workerBaseUrl + path, {
    method,
    headers: {
      authorization: "Bearer " + token,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    credentials: "omit",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "No fue posible completar la solicitud.");
    error.code = data.error || "worker-request-failed";
    error.status = response.status;
    throw error;
  }
  return data;
}
