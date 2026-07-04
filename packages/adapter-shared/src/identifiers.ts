export interface SqlIdentifierOptions {
  readonly label: string;
  readonly allowLeadingUnderscore?: boolean;
  readonly createError?: (message: string) => Error;
}

export interface QualifiedTableOptions extends SqlIdentifierOptions {
  readonly allowQualified?: boolean;
  readonly defaultSchema?: string;
}

export interface NormalizedQualifiedTable {
  readonly schema: string | undefined;
  readonly table: string;
  readonly qualifiedName: string;
}

export function assertSqlIdentifier(
  value: unknown,
  options: SqlIdentifierOptions,
): string {
  const leading =
    options.allowLeadingUnderscore === false ? "[A-Za-z]" : "[A-Za-z_]";
  const pattern = new RegExp(`^${leading}[A-Za-z0-9_]*$`);
  if (typeof value !== "string" || !pattern.test(value)) {
    const message = `${options.label} must be a valid SQL identifier.`;
    throw options.createError?.(message) ?? new TypeError(message);
  }
  return value;
}

export function normalizeQualifiedTable(
  value: unknown,
  options: QualifiedTableOptions,
): Readonly<NormalizedQualifiedTable> {
  if (typeof value !== "string") return invalidTable(options);
  const parts = value.split(".");
  if (
    parts.length > 2 ||
    (parts.length === 2 && options.allowQualified === false)
  ) {
    return invalidTable(options);
  }
  try {
    for (const part of parts) assertSqlIdentifier(part, options);
  } catch {
    return invalidTable(options);
  }
  const table = parts.at(-1)!;
  const schema = parts.length === 2 ? parts[0]! : options.defaultSchema;
  return Object.freeze({
    schema,
    table,
    qualifiedName: schema === undefined ? table : `${schema}.${table}`,
  });
}

function invalidTable(options: QualifiedTableOptions): never {
  const qualification =
    options.allowQualified === false
      ? "an unqualified identifier"
      : "an unaliased identifier or schema-qualified identifier";
  const message = `${options.label} must be ${qualification}.`;
  throw options.createError?.(message) ?? new TypeError(message);
}
