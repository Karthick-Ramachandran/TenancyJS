export interface TenantRecord {
  readonly id: string;
}

export type TenancyStrategy = "rowLevel" | "databasePerTenant";

export interface TenancyConfig {
  readonly strategy: TenancyStrategy;
}

export type TenantExecutionContext<
  TTenant extends TenantRecord = TenantRecord,
> = Readonly<{
  mode: "tenant";
  tenant: Readonly<TTenant>;
}>;

export type CentralContext = Readonly<{
  mode: "central";
}>;

export type TenantContext<TTenant extends TenantRecord = TenantRecord> =
  TenantExecutionContext<TTenant> | CentralContext;

export type MaybePromise<T> = T | Promise<T>;

export interface TenancyBootstrapper<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly id: string;
  bootstrap(context: TenantExecutionContext<TTenant>): MaybePromise<void>;
  revert(context: TenantExecutionContext<TTenant>): MaybePromise<void>;
}

export type TenancyLifecycleEventName =
  | "tenancy.initializing"
  | "tenancy.initialized"
  | "tenancy.ending"
  | "tenancy.ended";

export type TenancyLifecycleListener<
  TTenant extends TenantRecord = TenantRecord,
> = (context: TenantExecutionContext<TTenant>) => MaybePromise<void>;

export interface TenancyManagerOptions<
  TTenant extends TenantRecord = TenantRecord,
> {
  readonly bootstrappers?: readonly TenancyBootstrapper<TTenant>[];
}
