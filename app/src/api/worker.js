const workerBaseUrl = String(import.meta.env.VITE_SANDWICHIES_WORKER_URL || "").trim().replace(new RegExp("/+$"), "");
const REQUEST_TIMEOUT_MS = 25_000;

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
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(workerBaseUrl + path, {
      method,
      headers: {
        authorization: "Bearer " + token,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "No fue posible completar la solicitud.");
      error.code = data.error || "worker-request-failed";
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("El Worker no respondió en 25 segundos. Revisa la terminal del Worker y el estado de Firestore; la operación pudo no haberse completado.");
      timeoutError.code = "worker-request-timeout";
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error("No se pudo conectar con el Worker. Verifica que esté iniciado y que la URL y CORS estén configurados.");
      networkError.code = "worker-network-error";
      throw networkError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
