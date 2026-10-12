// fetch a nuestra API: devuelve el JSON o lanza un Error con el mensaje
// que mando el servidor ({ error: "..." }). Si la sesion termino (401), avisa
// a la pagina para que vuelva a la pantalla de entrada.
export const SESSION_ENDED = "pd:session-ended";

export function checkSession(res: Response) {
  if (res.status === 401) window.dispatchEvent(new Event(SESSION_ENDED));
}

export async function api<T = any>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!res.ok) {
    if (json?.code === "no-session") checkSession(res);
    throw new Error(json?.error || "Algo salió mal. Intenta de nuevo.");
  }
  return json as T;
}
