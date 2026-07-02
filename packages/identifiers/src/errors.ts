export class IdentifierConfigurationError extends Error {
  readonly code = "TENANCY_IDENTIFIER_CONFIGURATION";

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class TenantResolutionError extends Error {
  readonly code = "TENANCY_RESOLUTION_FAILED";
  readonly sourceId: string;

  constructor(sourceId: string, cause: unknown) {
    super(`Tenant resolution source "${sourceId}" failed.`, { cause });
    this.name = new.target.name;
    this.sourceId = sourceId;
  }
}
