import "reflect-metadata";

import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createTypeOrmTenancy } from "tenancyjs-adapter-typeorm";
import { TenancyManager } from "tenancyjs-core";
import knex, { type Knex } from "knex";
import request from "supertest";
import { DataSource, EntitySchema } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { TenancyModule, TenantRoute } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schema = `nest_typeorm_${suffix}`;
const runtimeRole = `nest_typeorm_runtime_${suffix}`;

interface Tenant {
  readonly id: string;
}

interface Post {
  id: string;
  tenantId: string;
  title: string;
}

const PostEntity = new EntitySchema<Post>({
  name: `NestPost_${suffix}`,
  tableName: "posts",
  schema,
  columns: {
    id: { type: String, primary: true },
    tenantId: { type: String, name: "tenant_id", primary: true },
    title: { type: String },
  },
});

describePostgres("NestJS + TypeORM PostgreSQL isolation", () => {
  const manager = new TenancyManager<Tenant>();
  let admin: Knex;
  let dataSource: DataSource;
  let tenancy: ReturnType<typeof createTypeOrmTenancy<Tenant>>;
  let app: INestApplication;
  let controllerCalls = 0;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.schema.createSchema(schema);
    await admin.schema.withSchema(schema).createTable("posts", (table) => {
      table.text("id").notNullable();
      table.text("tenant_id").notNullable();
      table.text("title").notNullable();
      table.primary(["id", "tenant_id"]);
    });
    await admin.raw(`alter table ${schema}.posts enable row level security`);
    await admin.raw(`alter table ${schema}.posts force row level security`);
    await admin.raw(`
      create policy posts_tenant_isolation on ${schema}.posts
      using (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
      with check (
        current_setting('tenancyjs.is_central', true) = 'true'
        or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
      )
    `);
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    await admin.raw(`grant usage on schema ${schema} to ${runtimeRole}`);
    await admin.raw(
      `grant select, insert, update, delete on ${schema}.posts to ${runtimeRole}`,
    );
    await admin
      .withSchema(schema)
      .table("posts")
      .insert([
        { id: "same-id", tenant_id: "tenant-a", title: "A" },
        { id: "same-id", tenant_id: "tenant-b", title: "B" },
      ]);

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    dataSource = await new DataSource({
      type: "postgres",
      url: runtimeUrl.toString(),
      entities: [PostEntity],
      synchronize: false,
    }).initialize();
    tenancy = createTypeOrmTenancy({
      manager,
      dataSource,
      tenantEntities: [
        {
          entity: PostEntity,
          table: `${schema}.posts`,
          tenantProperty: "tenantId",
          tenantColumn: "tenant_id",
        },
      ],
    });
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });

    class PostsController {
      posts() {
        controllerCalls += 1;
        return tenancy.run((client) => client.repository(PostEntity).findBy());
      }
    }
    Controller()(PostsController);
    const descriptor = Object.getOwnPropertyDescriptor(
      PostsController.prototype,
      "posts",
    )!;
    Get("posts")(PostsController.prototype, "posts", descriptor);
    TenantRoute()(PostsController.prototype, "posts", descriptor);

    const resolver = {
      resolve: async (input: {
        readonly headers?: Readonly<Record<string, unknown>>;
      }) => {
        const id = input.headers?.["x-tenant-id"];
        return typeof id === "string"
          ? {
              status: "resolved" as const,
              identifier: { resolverId: "test", kind: "header", value: id },
              tenant: { id },
            }
          : ({ status: "no-identifier" } as const);
      },
    };
    const testing = await Test.createTestingModule({
      imports: [TenancyModule.forRoot({ manager, resolver })],
      controllers: [PostsController],
    }).compile();
    app = testing.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await tenancy?.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  it("keeps concurrent requests with colliding ids in their tenant", async () => {
    const [tenantA, tenantB] = await Promise.all([
      request(app.getHttpServer())
        .get("/posts")
        .set("x-tenant-id", "tenant-a")
        .expect(200),
      request(app.getHttpServer())
        .get("/posts")
        .set("x-tenant-id", "tenant-b")
        .expect(200),
    ]);

    expect(tenantA.body).toEqual([
      { id: "same-id", tenantId: "tenant-a", title: "A" },
    ]);
    expect(tenantB.body).toEqual([
      { id: "same-id", tenantId: "tenant-b", title: "B" },
    ]);
    expect(controllerCalls).toBe(2);
    expect(manager.getContext()).toBeUndefined();
  });

  it("fails before the controller when tenant identity is missing", async () => {
    const callsBefore = controllerCalls;
    await request(app.getHttpServer()).get("/posts").expect(400);
    expect(controllerCalls).toBe(callsBefore);
    expect(manager.getContext()).toBeUndefined();
  });
});
