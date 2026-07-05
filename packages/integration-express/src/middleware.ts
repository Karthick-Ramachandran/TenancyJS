import type { TenantRecord } from "tenancyjs-core";
import type {
  ResolverHeaderValue,
  ResolverInput,
  TenantResolutionOutcome,
} from "tenancyjs-identifiers";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
  ExpressTenancyConfigurationError,
  ExpressTenancyResolutionError,
} from "./errors.js";
import type {
  ExpressTenancyErrorHandler,
  ExpressTenancyMiddlewareOptions,
  ExpressTenancyResolutionFailure,
} from "./types.js";

interface ValidatedOptions<TTenant extends TenantRecord> {
  readonly manager: ExpressTenancyMiddlewareOptions<TTenant>["manager"];
  readonly resolver: ExpressTenancyMiddlewareOptions<TTenant>["resolver"];
  readonly onError: ExpressTenancyErrorHandler;
}

export function createExpressTenancyMiddleware<
  TTenant extends TenantRecord = TenantRecord,
>(options: ExpressTenancyMiddlewareOptions<TTenant>): RequestHandler {
  const validated = validateOptions(options);

  return async function tenancyMiddleware(request, response, next) {
    let outcome: TenantResolutionOutcome<TTenant>;
    try {
      outcome = await validated.resolver.resolve(createResolverInput(request));
    } catch (error) {
      next(error);
      return;
    }

    if (outcome.status !== "resolved") {
      await validated.onError(
        createResolutionError(outcome),
        request,
        response,
        next,
      );
      return;
    }

    await validated.manager.runWithTenant(outcome.tenant, () =>
      waitForRequestCompletion(request, response, next),
    );
  };
}

function validateOptions<TTenant extends TenantRecord>(
  options: ExpressTenancyMiddlewareOptions<TTenant>,
): ValidatedOptions<TTenant> {
  if (options === null || typeof options !== "object") {
    throw new ExpressTenancyConfigurationError(
      "Express tenancy middleware options are required.",
    );
  }
  if (
    options.manager === null ||
    typeof options.manager !== "object" ||
    typeof options.manager.runWithTenant !== "function"
  ) {
    throw new ExpressTenancyConfigurationError(
      "Express tenancy middleware requires a TenancyManager.",
    );
  }
  if (
    options.resolver === null ||
    typeof options.resolver !== "object" ||
    typeof options.resolver.resolve !== "function"
  ) {
    throw new ExpressTenancyConfigurationError(
      "Express tenancy middleware requires a tenant resolver.",
    );
  }
  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new ExpressTenancyConfigurationError(
      "Express tenancy middleware onError must be a function.",
    );
  }

  return Object.freeze({
    manager: options.manager,
    resolver: options.resolver,
    onError: options.onError ?? defaultErrorHandler,
  });
}

function createResolverInput(request: Request): ResolverInput {
  const headers: Record<string, ResolverHeaderValue> = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") {
      headers[name] = value;
    } else if (Array.isArray(value)) {
      headers[name] = Object.freeze([...value]);
    }
  }

  return Object.freeze({
    host: headers.host,
    headers: Object.freeze(headers),
  });
}

function createResolutionError<TTenant extends TenantRecord>(
  outcome: Exclude<TenantResolutionOutcome<TTenant>, { status: "resolved" }>,
): ExpressTenancyResolutionError {
  return new ExpressTenancyResolutionError(
    outcome.status satisfies ExpressTenancyResolutionFailure,
  );
}

function defaultErrorHandler(
  error: ExpressTenancyResolutionError,
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  next(error);
}

function waitForRequestCompletion(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = (): void => {
      response.removeListener("finish", complete);
      response.removeListener("close", complete);
      request.removeListener("aborted", complete);
    };
    const complete = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    response.once("finish", complete);
    response.once("close", complete);
    request.once("aborted", complete);

    try {
      next();
    } catch (error) {
      fail(error);
      return;
    }

    if (response.writableFinished || response.destroyed || request.aborted) {
      complete();
    }
  });
}
