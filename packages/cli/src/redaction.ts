const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+(?::[^\s/@]*)?)@/giu;
const SECRET_ASSIGNMENT =
  /\b(database_url|tenant_database_url_template|password|secret|token|api[_-]?key)\s*[:=]\s*([^\s,}]+)/giu;

/**
 * Object keys whose values are treated as secrets and replaced wholesale. This
 * is what makes structured (`--json`) redaction sound: a regex over serialised
 * JSON cannot catch `"password": "…"` (the quote sits between key and colon),
 * so we redact the object graph by key name BEFORE serialising instead.
 */
const SECRET_KEY =
  /pass(word)?|secret|token|api[-_]?key|url|uri|dsn|connection|credential/iu;

export function redactText(value: string): string {
  return value
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]");
}

/**
 * Deep-redact an arbitrary value before it is serialised or rendered: any
 * object key that names a secret has its value replaced with `[REDACTED]`, and
 * every surviving string still runs through {@link redactText} so embedded
 * connection-string credentials are stripped wherever they appear. Use this for
 * all structured output (`--json` and the human record formatters) — never rely
 * on regexing already-serialised JSON.
 */
export function redactData(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((entry) => redactData(entry));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SECRET_KEY.test(key) ? "[REDACTED]" : redactData(entry);
    }
    return result;
  }
  return value;
}
