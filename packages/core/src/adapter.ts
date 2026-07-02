import type { MaybePromise, TenancyStrategy } from "./types.js";

export type TenancyAdapterCapabilityStatus =
  "supported" | "rejected" | "unsupported";

export interface TenancyAdapterCapabilities {
  readonly rowLevel: TenancyAdapterCapabilityStatus;
  readonly databasePerTenant: TenancyAdapterCapabilityStatus;
  readonly centralModels: TenancyAdapterCapabilityStatus;
  readonly transactions: TenancyAdapterCapabilityStatus;
  readonly nestedReads: TenancyAdapterCapabilityStatus;
  readonly nestedWrites: TenancyAdapterCapabilityStatus;
  readonly rawQueries: TenancyAdapterCapabilityStatus;
}

export type TenancyAdapterValidationSeverity = "error" | "warning";

export interface TenancyAdapterValidationIssue {
  readonly code: string;
  readonly severity: TenancyAdapterValidationSeverity;
  readonly message: string;
}

export interface TenancyAdapterValidationResult {
  readonly valid: boolean;
  readonly issues: readonly TenancyAdapterValidationIssue[];
}

export interface TenancyAdapter {
  readonly name: string;
  readonly strategy: TenancyStrategy;
  readonly capabilities: Readonly<TenancyAdapterCapabilities>;
  validate(): MaybePromise<TenancyAdapterValidationResult>;
}
