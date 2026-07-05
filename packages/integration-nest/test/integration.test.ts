import "reflect-metadata";

import type { ExecutionContext } from "@nestjs/common";
import { Controller, Get } from "@nestjs/common";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { TenancyManager } from "@tenancyjs/core";
import { firstValueFrom, Observable, of } from "rxjs";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  NestTenancyConfigurationError,
  NestTenancyResolutionError,
  NestTenantContextInterceptor,
  NestTenantResolutionGuard,
  NestTenantResolutionStore,
  TENANT_ROUTE_METADATA,
  TenancyModule,
  TenantRoute,
  createNestResolverInput,
} from "../src/index.js";

interface Tenant {
  readonly id: string;
  readonly name: string;
}

describe("Nest tenancy lifecycle", () => {
  it("snapshots safe structural request metadata", () => {
    const input = createNestResolverInput({
      hostname: "acme.example.test",
      headers: {
        "X-Tenant-ID": "tenant-a",
        cookie: ["a", "b"],
        ignored: 42,
      },
    });
    expect(input).toEqual({
      host: "acme.example.test",
      headers: {
        "x-tenant-id": "tenant-a",
        cookie: ["a", "b"],
      },
    });
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.headers)).toBe(true);
    expect(() => createNestResolverInput(null)).toThrow(
      NestTenancyConfigurationError,
    );
  });

  it("resolves marked routes once and keeps the handoff private", async () => {
    const requestObject = { headers: { "x-tenant-id": "tenant-a" } };
    const tenant = Object.freeze({ id: "tenant-a", name: "A" });
    const resolver = { resolve: vi.fn(async () => resolved(tenant)) };
    const store = new NestTenantResolutionStore<Tenant>();
    const guard = new NestTenantResolutionGuard(
      reflector(true),
      resolver,
      store,
    );
    await expect(guard.canActivate(context(requestObject))).resolves.toBe(true);
    expect(resolver.resolve).toHaveBeenCalledTimes(1);
    expect(store.get(requestObject)).toEqual(tenant);
    expect(store.consume(requestObject)).toEqual(tenant);
    expect(() => store.consume(requestObject)).toThrow(
      NestTenancyConfigurationError,
    );
  });

  it.each([
    ["no-identifier", 400],
    ["invalid", 400],
    ["not-found", 404],
    ["suspended", 404],
    ["ambiguous", 500],
  ] as const)(
    "maps %s without entering context",
    async (status, httpStatus) => {
      const store = new NestTenantResolutionStore<Tenant>();
      const guard = new NestTenantResolutionGuard(
        reflector(true),
        { resolve: async () => ({ status }) as never },
        store,
      );
      const failure = guard.canActivate(context({ headers: {} }));
      await expect(failure).rejects.toBeInstanceOf(NestTenancyResolutionError);
      await expect(failure).rejects.toMatchObject({ status: httpStatus });
    },
  );

  it("keeps manager and executor active through observable completion", async () => {
    const manager = new TenancyManager<Tenant>();
    const tenant = Object.freeze({ id: "tenant-a", name: "A" });
    const requestObject = {};
    const store = new NestTenantResolutionStore<Tenant>();
    store.set(requestObject, tenant);
    const events: string[] = [];
    const executor = {
      async run<TResult>(callback: () => Promise<TResult>): Promise<TResult> {
        events.push(`enter:${manager.getTenantOrFail().id}`);
        try {
          return await callback();
        } finally {
          events.push(`exit:${manager.getTenantOrFail().id}`);
        }
      },
    };
    const interceptor = new NestTenantContextInterceptor(
      reflector(true),
      manager,
      store,
      executor,
    );
    const value = await firstValueFrom(
      interceptor.intercept(context(requestObject), {
        handle: () =>
          new Observable<string>((subscriber) => {
            queueMicrotask(() => {
              subscriber.next(manager.getTenantOrFail().id);
              subscriber.complete();
            });
          }),
      }),
    );
    expect(value).toBe("tenant-a");
    await vi.waitFor(() => {
      expect(events).toEqual(["enter:tenant-a", "exit:tenant-a"]);
      expect(manager.getContext()).toBeUndefined();
    });
  });

  it("passes unmarked routes through without resolution state", async () => {
    const manager = new TenancyManager<Tenant>();
    const interceptor = new NestTenantContextInterceptor(
      reflector(false),
      manager,
      new NestTenantResolutionStore(),
      undefined,
    );
    await expect(
      firstValueFrom(
        interceptor.intercept(context({}), { handle: () => of("public") }),
      ),
    ).resolves.toBe("public");
  });

  it.each(["express", "fastify"] as const)(
    "runs a real Nest %s application with concurrent tenant isolation",
    async (platform) => {
      const manager = new TenancyManager<Tenant>();
      const resolver = {
        resolve: async (input: {
          readonly headers?: Readonly<Record<string, unknown>>;
        }) => {
          const id = input.headers?.["x-tenant-id"];
          return typeof id === "string"
            ? resolved({ id, name: id })
            : ({ status: "no-identifier" } as const);
        },
      };
      class TestController {
        async tenant(): Promise<{ id: string }> {
          await Promise.resolve();
          return { id: manager.getTenantOrFail().id };
        }

        public(): { public: true } {
          return { public: true };
        }
      }
      decorateController(TestController);
      const testing = await Test.createTestingModule({
        imports: [TenancyModule.forRoot({ manager, resolver })],
        controllers: [TestController],
      }).compile();
      const app =
        platform === "fastify"
          ? testing.createNestApplication<NestFastifyApplication>(
              new FastifyAdapter(),
            )
          : testing.createNestApplication();
      await app.init();

      try {
        if (platform === "fastify") {
          const fastify = app as NestFastifyApplication;
          await fastify.getHttpAdapter().getInstance().ready();
          const [a, b] = await Promise.all([
            fastify.inject({
              method: "GET",
              url: "/tenant",
              headers: { "x-tenant-id": "tenant-a" },
            }),
            fastify.inject({
              method: "GET",
              url: "/tenant",
              headers: { "x-tenant-id": "tenant-b" },
            }),
          ]);
          expect(a.json()).toEqual({ id: "tenant-a" });
          expect(b.json()).toEqual({ id: "tenant-b" });
          expect(
            (await fastify.inject({ method: "GET", url: "/tenant" }))
              .statusCode,
          ).toBe(400);
          expect(
            (await fastify.inject({ method: "GET", url: "/public" })).json(),
          ).toEqual({ public: true });
        } else {
          const server = app.getHttpServer();
          const [a, b] = await Promise.all([
            request(server).get("/tenant").set("x-tenant-id", "tenant-a"),
            request(server).get("/tenant").set("x-tenant-id", "tenant-b"),
          ]);
          expect(a.body).toEqual({ id: "tenant-a" });
          expect(b.body).toEqual({ id: "tenant-b" });
          await request(server).get("/tenant").expect(400);
          await request(server).get("/public").expect(200, { public: true });
        }
        expect(manager.getContext()).toBeUndefined();
      } finally {
        await app.close();
      }
    },
  );
});

function resolved(tenant: Tenant) {
  return {
    status: "resolved" as const,
    identifier: { resolverId: "test", kind: "header", value: tenant.id },
    tenant: Object.freeze({ ...tenant }),
  };
}

function reflector(marked: boolean) {
  return {
    getAllAndOverride: vi.fn(() => marked),
  } as never;
}

function context(requestObject: object): ExecutionContext {
  return {
    getClass: () => class Test {},
    getHandler: () => function test() {},
    switchToHttp: () => ({ getRequest: () => requestObject }),
  } as never;
}

function decorateController(target: new () => object): void {
  Controller()(target);
  for (const [method, path, tenant] of [
    ["tenant", "tenant", true],
    ["public", "public", false],
  ] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(
      target.prototype,
      method,
    )!;
    Get(path)(target.prototype, method, descriptor);
    if (tenant) TenantRoute()(target.prototype, method, descriptor);
  }
  expect(
    Reflect.getMetadata(TENANT_ROUTE_METADATA, target.prototype.tenant),
  ).toBe(true);
}
