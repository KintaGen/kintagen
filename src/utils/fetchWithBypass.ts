// src/utils/fetchWithBypass.ts

// Utility to wrap fetch with the Bypass-Tunnel-Reminder header
export async function fetchWithBypass(
    input: RequestInfo | URL,
    init: RequestInit = {}
  ): Promise<Response> {
    const bypassHeader = { 'Bypass-Tunnel-Reminder': 'true' };
    let headers: HeadersInit = bypassHeader;
  
    if (init.headers) {
      if (init.headers instanceof Headers) {
        const h = new Headers(init.headers);
        h.set('Bypass-Tunnel-Reminder', 'true');
        headers = h;
      } else if (Array.isArray(init.headers)) {
        headers = [...init.headers, ['Bypass-Tunnel-Reminder', 'true']];
      } else {
        headers = { ...init.headers, ...bypassHeader };
      }
    }
  
    return fetch(input as any, { ...init, headers });
  }
  