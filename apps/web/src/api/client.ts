export class RequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch('/api' + path, { ...options, credentials: 'same-origin', cache: 'no-store', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new RequestError(0, 'NETWORK', '서버에 연결할 수 없습니다. 로컬 API 실행 상태를 확인하고 다시 시도해 주세요.'); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new RequestError(response.status, data.code ?? 'REQUEST_FAILED', data.message ?? '요청을 처리하지 못했습니다. 다시 시도해 주세요.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
