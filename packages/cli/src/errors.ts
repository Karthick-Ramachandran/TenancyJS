export type CliErrorCode =
  | "TENANCY_CLI_USAGE"
  | "TENANCY_CLI_PROJECT"
  | "TENANCY_CLI_SECURITY"
  | "TENANCY_CLI_CONFLICT"
  | "TENANCY_CLI_APPLY";

export class TenancyCliError extends Error {
  readonly code: CliErrorCode;

  constructor(message: string, code: CliErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class CliUsageError extends TenancyCliError {
  constructor(message: string) {
    super(message, "TENANCY_CLI_USAGE");
  }
}

export class CliProjectError extends TenancyCliError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "TENANCY_CLI_PROJECT", options);
  }
}

export class CliSecurityError extends TenancyCliError {
  constructor(message: string) {
    super(message, "TENANCY_CLI_SECURITY");
  }
}

export class CliConflictError extends TenancyCliError {
  readonly paths: readonly string[];

  constructor(paths: readonly string[]) {
    super(
      `Refusing to overwrite conflicting files: ${paths.join(", ")}`,
      "TENANCY_CLI_CONFLICT",
    );
    this.paths = Object.freeze([...paths]);
  }
}

export class CliApplyError extends TenancyCliError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "TENANCY_CLI_APPLY", options);
  }
}
