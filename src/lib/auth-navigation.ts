export function safeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "http://healthmate.local");
    if (url.origin !== "http://healthmate.local" || !["/", "/journey", "/appointments/new"].includes(url.pathname)) return "/";
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}
