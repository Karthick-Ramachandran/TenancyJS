import type { TenancyAdapterValidationResult } from "@tenancyjs/core";
import type {
  ResolverInput,
  TenantIdentifier,
  TenantResolutionOutcome,
} from "@tenancyjs/identifiers";
import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";
import type { ApplicationService } from "@adonisjs/core/types";

import type {
  AdonisTenancyConfig,
  AdonisTenancyRunner,
  AdonisTenantResolver,
} from "../src/index.js";

export interface TestTenant {
  readonly id: string;
  readonly name: string;
}

export const identifier: TenantIdentifier = {
  resolverId: "header",
  kind: "id",
  value: "tenant-a",
};

export function resolvedOutcome(
  tenant: TestTenant,
): TenantResolutionOutcome<TestTenant> {
  return { status: "resolved", identifier, tenant };
}

export type RecordingTenancy = AdonisTenancyRunner & {
  readonly events: string[];
  setValid(value: boolean): void;
};

export function recordingTenancy(): RecordingTenancy {
  const events: string[] = [];
  let valid = true;
  return {
    events,
    setValid(value) {
      valid = value;
    },
    async validate(): Promise<TenancyAdapterValidationResult> {
      return valid
        ? { valid: true, issues: [] }
        : {
            valid: false,
            issues: [
              { code: "TEST_INVALID", severity: "error", message: "invalid" },
            ],
          };
    },
    async run(callback) {
      events.push("run:start");
      try {
        const result = await callback();
        events.push("run:commit");
        return result;
      } catch (error) {
        events.push("run:rollback");
        throw error;
      }
    },
  };
}

export type CountingResolver = AdonisTenantResolver<TestTenant> & {
  calls: number;
  lastInput?: ResolverInput;
};

export function countingResolver(
  outcome: TenantResolutionOutcome<TestTenant>,
): CountingResolver {
  const resolver: CountingResolver = {
    calls: 0,
    async resolve(input) {
      resolver.calls += 1;
      resolver.lastInput = input;
      return outcome;
    },
  };
  return resolver;
}

export function fakeContext(
  options: {
    host?: string | null;
    headers?: Record<string, string | string[]>;
  } = {},
): HttpContext {
  const host =
    options.host === undefined ? "tenant-a.example.com" : options.host;
  const headers: Record<string, string | string[]> = {
    ...(host === null ? {} : { host }),
    ...options.headers,
  };
  return {
    request: {
      headers: () => headers,
      host: () => host,
    },
  } as unknown as HttpContext;
}

export type NextSpy = NextFn & { calls: number };

export function nextSpy(impl?: () => void | Promise<void>): NextSpy {
  const fn = (async () => {
    fn.calls += 1;
    if (impl !== undefined) {
      await impl();
    }
  }) as NextSpy;
  fn.calls = 0;
  return fn;
}

export function fakeApp(config: AdonisTenancyConfig<TestTenant>): {
  app: ApplicationService;
  bindings: Map<unknown, () => unknown>;
} {
  const bindings = new Map<unknown, () => unknown>();
  const app = {
    config: {
      get: (key: string) => (key === "tenancy" ? config : undefined),
    },
    container: {
      singleton: (key: unknown, factory: () => unknown) => {
        bindings.set(key, factory);
      },
    },
  } as unknown as ApplicationService;
  return { app, bindings };
}
