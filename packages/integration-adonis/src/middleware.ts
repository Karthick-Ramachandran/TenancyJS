import type { TenantRecord } from "@tenancyjs/core";
import type {
  ResolverHeaderValue,
  ResolverInput,
  TenantResolutionOutcome,
} from "@tenancyjs/identifiers";
import type { HttpContext } from "@adonisjs/core/http";
import type { NextFn } from "@adonisjs/core/types/http";

import { AdonisTenancyResolutionError } from "./errors.js";
import type {
  AdonisTenancyConfig,
  AdonisTenancyResolutionFailure,
} from "./types.js";

/**
 * Tenant-route middleware. It reads a frozen host/header snapshot from the
 * request, resolves the tenant exactly once, and — only for a `resolved`
 * outcome — enters tenant context and the Lucid managed transaction around
 * `await next()`. A handler or transaction failure rolls back and releases
 * through the Lucid service. Every non-resolved outcome is mapped to a
 * sanitized error; resolver failure never becomes central context.
 */
export class TenancyMiddleware<TTenant extends TenantRecord = TenantRecord> {
  readonly #config: AdonisTenancyConfig<TTenant>;

  constructor(config: AdonisTenancyConfig<TTenant>) {
    this.#config = config;
  }

  async handle(ctx: HttpContext, next: NextFn): Promise<void> {
    const outcome = await this.#config.resolver.resolve(
      createResolverInput(ctx),
    );

    if (outcome.status !== "resolved") {
      await this.#config.onError(createResolutionError(outcome), ctx);
      return;
    }

    await this.#config.manager.runWithTenant(outcome.tenant, () =>
      this.#config.tenancy.run(() => next()),
    );
  }
}

function createResolverInput(ctx: HttpContext): ResolverInput {
  const headers: Record<string, ResolverHeaderValue> = {};
  for (const [name, value] of Object.entries(ctx.request.headers())) {
    if (typeof value === "string") {
      headers[name] = value;
    } else if (Array.isArray(value)) {
      headers[name] = Object.freeze([...value]);
    }
  }

  const host = ctx.request.host() ?? undefined;
  return Object.freeze({
    host: host ?? headers.host,
    headers: Object.freeze(headers),
  });
}

function createResolutionError<TTenant extends TenantRecord>(
  outcome: Exclude<TenantResolutionOutcome<TTenant>, { status: "resolved" }>,
): AdonisTenancyResolutionError {
  return new AdonisTenancyResolutionError(
    outcome.status satisfies AdonisTenancyResolutionFailure,
  );
}
