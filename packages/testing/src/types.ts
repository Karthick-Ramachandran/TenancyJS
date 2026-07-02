import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "@tenancyjs/core";

export interface TenantFixture extends TenantRecord {
  readonly name: string;
  readonly status: "active" | "suspended";
  readonly strategy: "rowLevel" | "databasePerTenant";
}

export interface TenancyContractCase {
  readonly name: string;
  run(): Promise<void>;
}

export interface TenancyIntegrationHarness<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly manager: TenancyManager<TTenant>;
  execute<TResult>(
    tenant: TTenant,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export type TenancyIntegrationHarnessFactory<
  TTenant extends TenantRecord = TenantRecord,
> = () => TenancyIntegrationHarness<TTenant>;
