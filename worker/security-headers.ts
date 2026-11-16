// Gleiche Header wie public/_headers (Static Assets), hier für die API-Antworten.
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

/** Header der App-Seiten, gleich wie `/*` in public/_headers (Abgleich per Test) */
export const PAGE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://tiles.openfreemap.org; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function withSecurityHeaders(
  response: Response,
  headers: Readonly<Record<string, string>> = SECURITY_HEADERS,
): Response {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) {
    secured.headers.set(name, value);
  }
  return secured;
}
