/**
 * Shared base for adapter error taxonomies. Each adapter declares its own
 * `<Adapter>TenancyErrorCode` union and extends this base so the constructor,
 * `code` field, and `name` (via `new.target`) live in one place instead of
 * being copy-pasted per adapter.
 */
export class AdapterTenancyError<TCode extends string = string> extends Error {
  readonly code: TCode;

  constructor(message: string, code: TCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}
