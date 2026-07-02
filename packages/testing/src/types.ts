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

export interface RowLevelAdapterContractRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly value: string;
}

export interface RowLevelAdapterContractCreateInput {
  readonly id: string;
  readonly value: string;
  readonly tenantId?: string;
}

export interface RowLevelAdapterContractOperations {
  create(
    input: RowLevelAdapterContractCreateInput,
  ): Promise<RowLevelAdapterContractRecord>;
  findMany(): Promise<readonly RowLevelAdapterContractRecord[]>;
  count(): Promise<number>;
  updateMany(value: string): Promise<number>;
  deleteMany(): Promise<number>;
}

export interface RowLevelAdapterContractHarness extends RowLevelAdapterContractOperations {
  reset(): Promise<void>;
  seed(records: readonly RowLevelAdapterContractRecord[]): Promise<void>;
  runWithTenant<TResult>(
    tenantId: string,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult>;
  runInCentralContext<TResult>(
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult>;
  transaction<TResult>(
    callback: (
      operations: RowLevelAdapterContractOperations,
    ) => MaybePromise<TResult>,
  ): Promise<TResult>;
}

export type RowLevelAdapterContractHarnessFactory = () =>
  RowLevelAdapterContractHarness | Promise<RowLevelAdapterContractHarness>;
