// fetch a nuestra API: devuelve el JSON o lanza un Error con el mensaje
// que mando el servidor ({ error: "..." }). Manda la sala abierta en el
// encabezado X-Group. Si la sesion termino (401) o ya no estas en la sala,
// avisa a la pagina.
export const SESSION_ENDED = "pd:session-ended";
export const GROUP_GONE = "pd:group-gone";

let currentGroup: string | null = null;

export function setApiGroup(gid: string | null) {
  currentGroup = gid;
}

export function groupHeaders(): Record<string, string> {
  return currentGroup ? { "X-Group": currentGroup } : {};
}

export function checkSession(res: Response, json?: any) {
  if (res.status === 401 && json?.code === "no-session") window.dispatchEvent(new Event(SESSION_ENDED));
  if ((res.status === 403 || res.status === 404) && json?.code === "no-group") window.dispatchEvent(new Event(GROUP_GONE));
}

export async function api<T = any>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...groupHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    // respuesta sin cuerpo JSON
  }
  if (!res.ok) {
    checkSession(res, json);
    throw new Error(json?.error || "Algo salió mal. Intenta de nuevo.");
  }
  return json as T;
}
