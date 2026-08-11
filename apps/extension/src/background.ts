/**
 * Background script — owns network calls so host_permissions apply
 * (popup fetch alone often hits CORS against localhost).
 *
 * Loaded as a service worker in Chromium and as an event page in Firefox
 * (see manifest background.scripts + background.service_worker).
 */
export type ApiRequestMessage = {
  type: "foliyo-api";
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  apiBase: string;
  binary?: boolean;
};

export type ApiResponseMessage =
  | { ok: true; status: number; bodyText?: string; bodyBase64?: string; contentType?: string }
  | { ok: false; status: number; error: string };

chrome.runtime.onMessage.addListener((message: ApiRequestMessage, _sender, sendResponse) => {
  if (!message || message.type !== "foliyo-api") return false;

  void (async () => {
    try {
      const url = `${message.apiBase.replace(/\/$/, "")}${message.path}`;
      const res = await fetch(url, {
        method: message.method ?? "GET",
        headers: message.headers,
        body: message.body ?? undefined,
      });

      if (message.binary) {
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const bodyBase64 = btoa(binary);
        const out: ApiResponseMessage = res.ok
          ? {
              ok: true,
              status: res.status,
              bodyBase64,
              contentType: res.headers.get("Content-Type") ?? "application/octet-stream",
            }
          : {
              ok: false,
              status: res.status,
              error: new TextDecoder().decode(bytes) || res.statusText,
            };
        sendResponse(out);
        return;
      }

      const bodyText = await res.text();
      const out: ApiResponseMessage = res.ok
        ? { ok: true, status: res.status, bodyText }
        : { ok: false, status: res.status, error: bodyText || res.statusText };
      sendResponse(out);
    } catch (err) {
      const out: ApiResponseMessage = {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : String(err),
      };
      sendResponse(out);
    }
  })();

  return true; // async sendResponse
});
