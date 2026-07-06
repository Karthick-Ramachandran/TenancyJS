import { EventEmitter } from "node:events";

import { TenancyManager } from "tenancyjs-core";
import type { TenantRecord } from "tenancyjs-core";
import {
  HeaderTenantResolver,
  TenantResolutionChain,
} from "tenancyjs-identifiers";
import {
  createIntegrationTenancyContract,
  createTenantFixture,
} from "tenancyjs-testing";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  ExpressTenancyConfigurationError,
  ExpressTenancyResolutionError,
  createExpressTenancyMiddleware,
} from "../src/index.js";
import type { ExpressTenantResolver } from "../src/index.js";

interface TestTenant extends TenantRecord {
  readonly name: string;
}

const tenantA: TestTenant = { id: "tenant-a", name: "Tenant A" };
const tenantB: TestTenant = { id: "tenant-b", name: "Tenant B" };

describe("createExpressTenancyMiddleware", () => {
  it("validates application-owned dependencies at startup", () => {
    const manager = new TenancyManager();
    const resolver = fixedResolver({ status: "no-identifier" });

    expect(() => createExpressTenancyMiddleware(null as never)).toThrow(
      ExpressTenancyConfigurationError,
    );
    expect(() =>
      createExpressTenancyMiddleware({ manager: {} as never, resolver }),
    ).toThrow("requires a TenancyManager");
    expect(() =>
      createExpressTenancyMiddleware({ manager, resolver: {} as never }),
    ).toThrow("requires a tenant resolver");
    expect(() =>
      createExpressTenancyMiddleware({
        manager,
        resolver,
        onError: "invalid" as never,
      }),
    ).toThrow("onError must be a function");
  });

  it("passes an immutable request metadata snapshot to the resolver", async () => {
    const manager = new TenancyManager();
    const originalHeaders = {
      host: "tenant.example.test",
      "x-tenant-id": ["tenant-a"],
    };
    let observedInput:
      Parameters<ExpressTenantResolver["resolve"]>[0] | undefined;
    const middleware = createExpressTenancyMiddleware({
      manager,
      resolver: {
        resolve(input) {
          observedInput = input;
          return { status: "no-identifier" };
        },
      },
      onError: () => undefined,
    });

    await invoke(
      middleware,
      fakeRequest(originalHeaders),
      fakeResponse(),
      vi.fn(),
    );

    expect(observedInput).toEqual({
      host: "tenant.example.test",
      headers: originalHeaders,
    });
    expect(observedInput?.headers).not.toBe(originalHeaders);
    expect(Object.isFrozen(observedInput)).toBe(true);
    expect(Object.isFrozen(observedInput?.headers)).toBe(true);
    expect(Object.isFrozen(observedInput?.headers?.["x-tenant-id"])).toBe(true);
  });

  it.each([
    ["no-identifier", 400, "Tenant identity is required."],
    ["invalid", 400, "Tenant identity is invalid."],
    ["not-found", 404, "Tenant was not found."],
    ["suspended", 404, "Tenant was not found."],
    ["ambiguous", 500, "Tenant resolution is unavailable."],
  ] as const)(
    "maps %s to a sanitized typed error",
    async (status, statusCode, message) => {
      const manager = new TenancyManager();
      const onError = vi.fn();
      const middleware = createExpressTenancyMiddleware({
        manager,
        resolver: fixedResolver(outcomeFor(status)),
        onError,
      });

      await invoke(
        middleware,
        fakeRequest({ "x-tenant-id": "secret-tenant-value" }),
        fakeResponse(),
        vi.fn(),
      );

      expect(onError).toHaveBeenCalledOnce();
      const error = onError.mock.calls[0]?.[0];
      expect(error).toMatchObject({
        code: "TENANCY_EXPRESS_RESOLUTION",
        reason: status,
        statusCode,
        message,
      });
      expect(error?.message).not.toContain("secret-tenant-value");
      expect(manager.getContext()).toBeUndefined();
    },
  );

  it("passes resolution failures to Express by default", async () => {
    const next = vi.fn();
    const middleware = createExpressTenancyMiddleware({
      manager: new TenancyManager(),
      resolver: fixedResolver({ status: "no-identifier" }),
    });

    await invoke(middleware, fakeRequest(), fakeResponse(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "TENANCY_EXPRESS_RESOLUTION",
        reason: "no-identifier",
      }),
    );
  });

  it("preserves resolver and custom error-handler failures", async () => {
    const resolverFailure = new Error("registry unavailable");
    const resolverNext = vi.fn();
    const resolverMiddleware = createExpressTenancyMiddleware({
      manager: new TenancyManager(),
      resolver: {
        resolve() {
          throw resolverFailure;
        },
      },
    });

    await invoke(
      resolverMiddleware,
      fakeRequest(),
      fakeResponse(),
      resolverNext,
    );
    expect(resolverNext).toHaveBeenCalledWith(resolverFailure);

    const handlerFailure = new Error("error policy failed");
    const handlerMiddleware = createExpressTenancyMiddleware({
      manager: new TenancyManager(),
      resolver: fixedResolver({ status: "no-identifier" }),
      onError: async () => {
        throw handlerFailure;
      },
    });

    await expect(
      invoke(handlerMiddleware, fakeRequest(), fakeResponse(), vi.fn()),
    ).rejects.toBe(handlerFailure);
  });

  it.each(["finish", "close", "aborted"] as const)(
    "keeps context active until %s and cleans listeners exactly once",
    async (terminalEvent) => {
      const bootstrap = vi.fn();
      const revert = vi.fn();
      const manager = new TenancyManager<TestTenant>({
        bootstrappers: [{ id: "request-resource", bootstrap, revert }],
      });
      const request = fakeRequest({ "x-tenant-id": tenantA.id });
      const response = fakeResponse();
      const middleware = createExpressTenancyMiddleware({
        manager,
        resolver: fixedResolver({
          status: "resolved",
          identifier: identifier(tenantA.id),
          tenant: tenantA,
        }),
      });
      const next = vi.fn(() => {
        expect(manager.getTenantOrFail().id).toBe(tenantA.id);
      });

      const completion = invoke(middleware, request, response, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
      expect(revert).not.toHaveBeenCalled();

      if (terminalEvent === "aborted") request.emit("aborted");
      else response.emit(terminalEvent);
      response.emit("close");
      await completion;

      expect(bootstrap).toHaveBeenCalledOnce();
      expect(revert).toHaveBeenCalledOnce();
      expect(response.listenerCount("finish")).toBe(0);
      expect(response.listenerCount("close")).toBe(0);
      expect(request.listenerCount("aborted")).toBe(0);
    },
  );

  it("cleans up when downstream dispatch throws synchronously", async () => {
    const failure = new Error("dispatch failed");
    const revert = vi.fn();
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [{ id: "request-resource", bootstrap: vi.fn(), revert }],
    });
    const middleware = createExpressTenancyMiddleware({
      manager,
      resolver: fixedResolver({
        status: "resolved",
        identifier: identifier(tenantA.id),
        tenant: tenantA,
      }),
    });

    await expect(
      invoke(middleware, fakeRequest(), fakeResponse(), () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(revert).toHaveBeenCalledOnce();
  });

  it("does not miss a response completed during synchronous dispatch", async () => {
    const response = fakeResponse();
    const middleware = createExpressTenancyMiddleware({
      manager: new TenancyManager(),
      resolver: fixedResolver({
        status: "resolved",
        identifier: identifier(tenantA.id),
        tenant: tenantA,
      }),
    });

    await invoke(middleware, fakeRequest(), response, () => {
      Object.defineProperty(response, "writableFinished", { value: true });
    });
  });
});

describe("Express integration contract", () => {
  for (const contractCase of createIntegrationTenancyContract(
    createContractHarness,
    [
      createTenantFixture({ id: tenantA.id }),
      createTenantFixture({ id: tenantB.id }),
    ],
  )) {
    it(contractCase.name, contractCase.run);
  }
});

describe("Express 5 request integration", () => {
  it("isolates concurrent requests and retains context in error middleware", async () => {
    const manager = new TenancyManager<TestTenant>();
    const app = express();
    app.use(
      createExpressTenancyMiddleware({
        manager,
        resolver: resolutionChain([tenantA, tenantB]),
      }),
    );
    app.get("/tenant/:delay", async (request_, response) => {
      await delay(Number(request_.params.delay));
      response.json({ tenantId: manager.getTenantOrFail().id });
    });
    app.get("/failure", async () => {
      throw new Error("route failed");
    });
    app.use(((error, _request, response, _next) => {
      void _next;
      if (error instanceof ExpressTenancyResolutionError) {
        response.status(error.statusCode).json({ code: error.code });
        return;
      }
      response.status(500).json({
        message: error instanceof Error ? error.message : "unknown",
        tenantId: manager.getTenantOrFail().id,
      });
    }) satisfies express.ErrorRequestHandler);

    const [first, second] = await Promise.all([
      request(app).get("/tenant/20").set("x-tenant-id", tenantA.id).expect(200),
      request(app).get("/tenant/1").set("x-tenant-id", tenantB.id).expect(200),
    ]);
    expect(first.body).toEqual({ tenantId: tenantA.id });
    expect(second.body).toEqual({ tenantId: tenantB.id });

    const failed = await request(app)
      .get("/failure")
      .set("x-tenant-id", tenantA.id)
      .expect(500);
    expect(failed.body).toEqual({
      message: "route failed",
      tenantId: tenantA.id,
    });
  });

  it("fails closed before tenant routes and hides tenant registry state", async () => {
    const manager = new TenancyManager<TestTenant>();
    const route = vi.fn((_request: Request, response: Response) => {
      response.sendStatus(204);
    });
    const app = express();
    app.use(
      createExpressTenancyMiddleware({
        manager,
        resolver: resolutionChain(
          [tenantA, { id: "suspended-secret", name: "Suspended" }],
          "suspended-secret",
        ),
      }),
    );
    app.get("/tenant", route);
    app.use(((error, _request, response, _next) => {
      void _next;
      if (error instanceof ExpressTenancyResolutionError) {
        response.status(error.statusCode).json({ message: error.message });
        return;
      }
      response.sendStatus(500);
    }) satisfies express.ErrorRequestHandler);

    await request(app)
      .get("/tenant")
      .expect(400, { message: "Tenant identity is required." });
    const unknown = await request(app)
      .get("/tenant")
      .set("x-tenant-id", "unknown-secret")
      .expect(404);
    const suspended = await request(app)
      .get("/tenant")
      .set("x-tenant-id", "suspended-secret")
      .expect(404);

    expect(unknown.body).toEqual(suspended.body);
    expect(JSON.stringify(unknown.body)).not.toContain("unknown-secret");
    expect(JSON.stringify(suspended.body)).not.toContain("suspended-secret");
    expect(route).not.toHaveBeenCalled();
  });

  it("releases request lifecycle resources when the client aborts", async () => {
    const bootstrap = vi.fn();
    const revert = vi.fn();
    const manager = new TenancyManager<TestTenant>({
      bootstrappers: [{ id: "request-resource", bootstrap, revert }],
    });
    const app = express();
    app.use(
      createExpressTenancyMiddleware({
        manager,
        resolver: resolutionChain([tenantA]),
      }),
    );
    app.get("/slow", async (_request, response) => {
      await delay(200);
      if (!response.destroyed) response.sendStatus(204);
    });

    const pending = request(app).get("/slow").set("x-tenant-id", tenantA.id);
    pending.end(() => undefined);
    await vi.waitFor(() => expect(bootstrap).toHaveBeenCalledOnce());
    pending.abort();
    await vi.waitFor(() => expect(revert).toHaveBeenCalledOnce());
  });
});

function fixedResolver<TTenant extends TenantRecord>(
  outcome: ReturnType<ExpressTenantResolver<TTenant>["resolve"]>,
): ExpressTenantResolver<TTenant> {
  return { resolve: () => outcome };
}

function outcomeFor(status: string) {
  switch (status) {
    case "no-identifier":
      return { status } as const;
    case "invalid":
      return { status, resolverId: "header", reason: "invalid-value" } as const;
    case "not-found":
      return { status, identifier: identifier("unknown") } as const;
    case "suspended":
      return { status, identifier: identifier("suspended") } as const;
    case "ambiguous":
      return {
        status,
        identifier: identifier("duplicate"),
        matchCount: 2,
      } as const;
    default:
      throw new Error(`Unsupported test status: ${status}`);
  }
}

function identifier(value: string) {
  return { resolverId: "header:x-tenant-id", kind: "header", value } as const;
}

function resolutionChain(
  tenants: readonly TestTenant[],
  suspendedId?: string,
): TenantResolutionChain<TestTenant> {
  return new TenantResolutionChain({
    authorize: () => true,
    resolvers: [new HeaderTenantResolver()],
    store: {
      find(identifier_) {
        const tenant = tenants.find(({ id }) => id === identifier_.value);
        return tenant === undefined
          ? []
          : [
              {
                tenant,
                status: tenant.id === suspendedId ? "suspended" : "active",
              },
            ];
      },
    },
  });
}

function fakeRequest(
  headers: Readonly<Record<string, string | readonly string[]>> = {},
): Request & EventEmitter {
  const request_ = new EventEmitter() as Request & EventEmitter;
  Object.assign(request_, { aborted: false, headers });
  return request_;
}

function fakeResponse(): Response & EventEmitter {
  const response = new EventEmitter() as Response & EventEmitter;
  Object.assign(response, { destroyed: false, writableFinished: false });
  return response;
}

function invoke(
  middleware: express.RequestHandler,
  request_: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  return Promise.resolve(middleware(request_, response, next) as void);
}

function createContractHarness() {
  const manager = new TenancyManager();
  const tenants = [
    createTenantFixture({ id: tenantA.id }),
    createTenantFixture({ id: tenantB.id }),
  ] as const;
  const middleware = createExpressTenancyMiddleware({
    manager,
    resolver: new TenantResolutionChain({
      authorize: () => true,
      resolvers: [new HeaderTenantResolver()],
      store: {
        find(identifier_) {
          const tenant = tenants.find(({ id }) => id === identifier_.value);
          return tenant === undefined ? [] : [{ tenant, status: "active" }];
        },
      },
    }),
  });

  return {
    manager,
    async execute<TResult>(
      tenant: (typeof tenants)[number],
      callback: () => TResult | Promise<TResult>,
    ): Promise<TResult> {
      const request_ = fakeRequest({ "x-tenant-id": tenant.id });
      const response = fakeResponse();
      let callbackResult: Promise<TResult> | undefined;

      const middlewareCompletion = invoke(
        middleware,
        request_,
        response,
        (error?: unknown) => {
          if (error !== undefined) {
            callbackResult = Promise.reject(error);
          } else {
            callbackResult = Promise.resolve().then(callback);
          }
          void callbackResult.then(
            () => response.emit("finish"),
            () => response.emit("finish"),
          );
        },
      );

      await middlewareCompletion;
      if (callbackResult === undefined) {
        throw new Error("Express integration did not dispatch the callback.");
      }
      return callbackResult;
    },
  };
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
