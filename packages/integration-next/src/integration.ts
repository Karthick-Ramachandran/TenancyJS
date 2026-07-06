import type { MaybePromise, TenantRecord } from "tenancyjs-core";
import type {
  ResolverHeaderValue,
  ResolverInput,
  TenantResolutionOutcome,
} from "tenancyjs-identifiers";
import { headers as nextHeaders } from "next/headers.js";

import {
  NextTenancyConfigurationError,
  NextTenancyResolutionError,
} from "./errors.js";
import { NEXT_TENANCY_HINT_HEADER, parseNextTenantHint } from "./hint.js";
import type {
  NextRequestInput,
  NextTenancy,
  NextTenancyOptions,
  NextTenancyResolutionFailure,
} from "./types.js";

const TENANT_HEADER = "x-tenant-id";

export function createNextTenancy<TTenant extends TenantRecord = TenantRecord>(
  options: NextTenancyOptions<TTenant>,
): NextTenancy {
  const validated = validateOptions(options);

  const runWithRequest: NextTenancy["runWithRequest"] = async (
    input,
    callback,
  ) => {
    if (typeof callback !== "function") {
      throw new NextTenancyConfigurationError(
        "Next tenancy execution requires a callback.",
      );
    }

    const resolverInput = createResolverInput(input);
    const outcome: TenantResolutionOutcome<TTenant> =
      await validated.resolver.resolve(resolverInput, {
        principal: await validated.principal?.(),
      });
    if (outcome.status !== "resolved") {
      throw createResolutionError(outcome);
    }
    return validated.manager.runWithTenant(outcome.tenant, callback);
  };

  function withRouteHandler<TArguments extends readonly unknown[], TResult>(
    handler: (
      request: Request,
      ...arguments_: TArguments
    ) => MaybePromise<TResult>,
  ): (request: Request, ...arguments_: TArguments) => Promise<TResult> {
    if (typeof handler !== "function") {
      throw new NextTenancyConfigurationError(
        "Next tenancy Route Handler must be a function.",
      );
    }
    return (request, ...arguments_) =>
      runWithRequest(request, () => handler(request, ...arguments_));
  }

  function withServerAction<TArguments extends readonly unknown[], TResult>(
    action: (...arguments_: TArguments) => MaybePromise<TResult>,
  ): (...arguments_: TArguments) => Promise<TResult> {
    if (typeof action !== "function") {
      throw new NextTenancyConfigurationError(
        "Next tenancy Server Action must be a function.",
      );
    }
    return async (...arguments_) => {
      const requestHeaders = await nextHeaders();
      return runWithRequest(requestHeaders, () => action(...arguments_));
    };
  }

  return Object.freeze({
    runWithRequest,
    withRouteHandler,
    withServerAction,
  });
}

function validateOptions<TTenant extends TenantRecord>(
  options: NextTenancyOptions<TTenant>,
): NextTenancyOptions<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new NextTenancyConfigurationError(
      "Next tenancy options are required.",
    );
  }
  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.runWithTenant !== "function"
  ) {
    throw new NextTenancyConfigurationError(
      "Next tenancy integration requires a TenancyManager.",
    );
  }
  if (
    options.resolver === null ||
    typeof options.resolver !== "object" ||
    typeof options.resolver.resolve !== "function"
  ) {
    throw new NextTenancyConfigurationError(
      "Next tenancy integration requires a tenant resolver.",
    );
  }
  if (
    options.principal !== undefined &&
    typeof options.principal !== "function"
  ) {
    throw new NextTenancyConfigurationError(
      "Next tenancy principal must be a function.",
    );
  }
  return Object.freeze({
    manager: options.manager,
    resolver: options.resolver,
    ...(options.principal === undefined
      ? {}
      : { principal: options.principal }),
  });
}

function createResolverInput(input: NextRequestInput): ResolverInput {
  if (input instanceof Request) return snapshotHeaders(input.headers);
  if (input instanceof Headers) return snapshotHeaders(input);
  if (input === null || typeof input !== "object") {
    throw new NextTenancyConfigurationError(
      "Next tenancy request input is required.",
    );
  }
  return snapshotResolverInput(input);
}

function snapshotHeaders(source: Headers): ResolverInput {
  const values: Record<string, ResolverHeaderValue> = {};
  for (const [name, value] of source.entries()) {
    values[name.toLowerCase()] = value;
  }
  applyHint(values);
  return freezeResolverInput(values.host, values);
}

function snapshotResolverInput(source: ResolverInput): ResolverInput {
  const values: Record<string, ResolverHeaderValue> = {};
  for (const [name, value] of Object.entries(source.headers ?? {})) {
    values[name.toLowerCase()] = copyHeaderValue(value);
  }
  applyHint(values);
  return freezeResolverInput(
    copyHeaderValue(source.host ?? values.host),
    values,
  );
}

function applyHint(values: Record<string, ResolverHeaderValue>): void {
  const rawHint = values[NEXT_TENANCY_HINT_HEADER];
  if (rawHint === undefined) return;
  if (typeof rawHint !== "string") {
    throw new NextTenancyResolutionError("invalid");
  }
  const hint = parseNextTenantHint(rawHint);
  if (hint === null) throw new NextTenancyResolutionError("invalid");
  delete values[NEXT_TENANCY_HINT_HEADER];
  if (hint.host !== undefined) values.host = combine(values.host, hint.host);
  if (hint.tenantId !== undefined) {
    values[TENANT_HEADER] = combine(values[TENANT_HEADER], hint.tenantId);
  }
}

function combine(
  original: ResolverHeaderValue,
  hinted: string,
): ResolverHeaderValue {
  if (original === undefined) return hinted;
  if (typeof original === "string" && original === hinted) return original;
  return Object.freeze([
    ...(typeof original === "string" ? [original] : original),
    hinted,
  ]);
}

function copyHeaderValue(value: ResolverHeaderValue): ResolverHeaderValue {
  return Array.isArray(value) ? Object.freeze([...value]) : value;
}

function freezeResolverInput(
  host: ResolverHeaderValue,
  values: Record<string, ResolverHeaderValue>,
): ResolverInput {
  const headers = Object.freeze({ ...values });
  return Object.freeze({
    ...(host === undefined ? {} : { host }),
    headers,
  });
}

function createResolutionError<TTenant extends TenantRecord>(
  outcome: Exclude<TenantResolutionOutcome<TTenant>, { status: "resolved" }>,
): NextTenancyResolutionError {
  return new NextTenancyResolutionError(
    outcome.status satisfies NextTenancyResolutionFailure,
  );
}
