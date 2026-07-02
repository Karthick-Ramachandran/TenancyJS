const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)([^\s/@]+(?::[^\s/@]*)?)@/giu;
const SECRET_ASSIGNMENT =
  /\b(database_url|tenant_database_url_template|password|secret|token|api[_-]?key)\s*[:=]\s*([^\s,}]+)/giu;

export function redactText(value: string): string {
  return value
    .replace(URL_CREDENTIALS, "$1[REDACTED]@")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]");
}
