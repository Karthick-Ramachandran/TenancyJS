import { Logger } from "@adonisjs/core/logger";
import { TenancyManager, type MaybePromise } from "@tenancyjs/core";
import { Database } from "@adonisjs/lucid/database";
import { BaseModel, column, hasMany } from "@adonisjs/lucid/orm";
import type { HasMany } from "@adonisjs/lucid/types/relations";
import knex, { type Knex } from "knex";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createLucidTenancy } from "../src/index.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl === undefined ? describe.skip : describe;
const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const schema = `lucid_tenancy_${suffix}`;
const runtimeRole = `lucid_runtime_${suffix}`;
const postsTable = `${schema}.posts`;
const commentsTable = `${schema}.comments`;
const postPolicy = "posts_tenant_isolation";
const commentPolicy = "comments_tenant_isolation";

interface TestTenant {
  readonly id: string;
  readonly name: string;
}

class Post extends BaseModel {
  static override table = postsTable;

  declare id: string;
  declare tenantId: string;
  declare title: string;
  declare score: number;
  declare comments: HasMany<typeof Comment>;
}

class Comment extends BaseModel {
  static override table = commentsTable;

  declare id: string;
  declare tenantId: string;
  declare postId: string;
  declare body: string;
}

column({ isPrimary: true })(Post.prototype, "id");
column({ columnName: "tenant_id" })(Post.prototype, "tenantId");
column()(Post.prototype, "title");
column()(Post.prototype, "score");
column({ isPrimary: true })(Comment.prototype, "id");
column({ columnName: "tenant_id" })(Comment.prototype, "tenantId");
column({ columnName: "post_id" })(Comment.prototype, "postId");
column()(Comment.prototype, "body");
hasMany(() => Comment, { foreignKey: "postId" })(Post.prototype, "comments");

describePostgres("Lucid 22 PostgreSQL row-level isolation", () => {
  let admin: Knex;
  let database: Database;
  let manager: TenancyManager<TestTenant>;
  let tenancy: ReturnType<typeof createLucidTenancy<TestTenant>>;

  beforeAll(async () => {
    admin = knex({ client: "pg", connection: databaseUrl! });
    await admin.raw(`create role ${runtimeRole} login nosuperuser nobypassrls`);
    await admin.schema.createSchema(schema);
    await admin.schema.withSchema(schema).createTable("posts", (table) => {
      table.string("id").primary();
      table.string("tenant_id").notNullable().index();
      table.string("title").notNullable();
      table.integer("score").notNullable().defaultTo(0);
    });
    await admin.schema.withSchema(schema).createTable("comments", (table) => {
      table.string("id").primary();
      table.string("tenant_id").notNullable().index();
      table
        .string("post_id")
        .notNullable()
        .references("id")
        .inTable(postsTable);
      table.string("body").notNullable();
    });
    await installPolicy(admin, postsTable, postPolicy);
    await installPolicy(admin, commentsTable, commentPolicy);
    await admin.raw(`grant usage on schema ${schema} to ${runtimeRole}`);
    await admin.raw(
      `grant select, insert, update, delete on ${postsTable}, ${commentsTable} to ${runtimeRole}`,
    );

    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.username = runtimeRole;
    runtimeUrl.password = "";
    database = new Database(
      {
        connection: "postgres",
        connections: {
          postgres: {
            client: "pg",
            connection: runtimeUrl.toString(),
            pool: { min: 0, max: 4 },
          },
        },
      },
      new Logger({ enabled: false }),
      {
        emit: async () => undefined,
        hasListeners: () => false,
      } as never,
    );
    BaseModel.useAdapter(database.modelAdapter());
    manager = new TenancyManager<TestTenant>();
    tenancy = createLucidTenancy({
      manager,
      database,
      tenantModels: [
        { model: Post, policyName: postPolicy },
        { model: Comment, policyName: commentPolicy },
      ],
    });
  });

  beforeEach(async () => {
    await admin(commentsTable).delete();
    await admin(postsTable).delete();
    await admin(postsTable).insert([
      { id: "post-a", tenant_id: "tenant-a", title: "A", score: 10 },
      { id: "post-b", tenant_id: "tenant-b", title: "B", score: 20 },
    ]);
    await admin(commentsTable).insert([
      { id: "comment-a", tenant_id: "tenant-a", post_id: "post-a", body: "A" },
      { id: "comment-b", tenant_id: "tenant-b", post_id: "post-b", body: "B" },
    ]);
    await expect(tenancy.validate()).resolves.toEqual({
      valid: true,
      issues: [],
    });
  });

  afterAll(async () => {
    await database?.manager.closeAll();
    if (admin !== undefined) {
      await admin.schema.dropSchemaIfExists(schema, true);
      await admin.raw(`drop role if exists ${runtimeRole}`);
      await admin.destroy();
    }
  });

  it("isolates concurrent model reads, pagination, aggregates, and relationships", async () => {
    const [tenantA, tenantB] = await Promise.all([
      withTenant("tenant-a", async () => {
        const posts = await Post.query().preload("comments").orderBy("id");
        const page = await Post.query().orderBy("id").paginate(1, 10);
        const aggregate = await Post.query()
          .sum("score as total")
          .firstOrFail();
        return { posts, page, aggregate };
      }),
      withTenant("tenant-b", () => Post.query().orderBy("id")),
    ]);

    expect(tenantA.posts.map((post) => post.id)).toEqual(["post-a"]);
    expect(tenantA.posts[0]!.comments.map((comment) => comment.id)).toEqual([
      "comment-a",
    ]);
    expect(tenantA.page.all().map((post) => post.id)).toEqual(["post-a"]);
    expect(Number(tenantA.aggregate.$extras.total)).toBe(10);
    expect(tenantB.map((post) => post.id)).toEqual(["post-b"]);
  });

  it("injects ownership and prevents cross-tenant model mutation", async () => {
    await withTenant("tenant-a", async () => {
      const created = await Post.create({
        id: "post-created",
        title: "Created",
        score: 1,
      });
      expect(created.tenantId).toBe("tenant-a");

      const tenantBPost = await Post.find("post-b");
      expect(tenantBPost).toBeNull();
      const updated = await Post.query().where("id", "post-b").update({
        title: "stolen",
      });
      const deleted = await Post.query().where("id", "post-b").delete();
      expect(updated).toEqual([0]);
      expect(deleted).toEqual([0]);

      created.title = "Updated";
      await created.save();
      await created.delete();
    });

    await expect(
      admin(postsTable).where({ id: "post-created" }).first(),
    ).resolves.toBeUndefined();
    await expect(
      admin(postsTable).where({ id: "post-b" }).first(),
    ).resolves.toMatchObject({
      title: "B",
    });
  });

  it("fails closed for pojo, quiet writes, and direct database builders", async () => {
    await withTenant("tenant-a", async () => {
      await expect(Post.query().pojo()).resolves.toEqual([]);
      await expect(database.from(postsTable).select("id")).resolves.toEqual([]);
      await expect(
        Post.createQuietly({
          id: "quiet",
          tenantId: "tenant-b",
          title: "Quiet",
          score: 0,
        }),
      ).rejects.toBeDefined();
    });
    await expect(
      admin(postsTable).where({ id: "quiet" }).first(),
    ).resolves.toBeUndefined();
  });

  it("rolls back failures, supports central context, and clears pooled identity", async () => {
    const failure = new Error("rollback");
    await expect(
      withTenant("tenant-a", async () => {
        await Post.create({ id: "rolled-back", title: "Rollback", score: 3 });
        throw failure;
      }),
    ).rejects.toBe(failure);
    await expect(
      admin(postsTable).where({ id: "rolled-back" }).first(),
    ).resolves.toBeUndefined();

    const all = await manager.runInCentralContext(() =>
      tenancy.run(() => Post.query().orderBy("id")),
    );
    expect(all.map((post) => post.id)).toEqual(["post-a", "post-b"]);
    await withTenant("tenant-a", () => Post.query());
    await withTenant("tenant-b", async () => {
      const posts = await Post.query();
      expect(posts.map((post) => post.id)).toEqual(["post-b"]);
    });
    await expect(database.from(postsTable).select("id")).resolves.toEqual([]);
  });

  function withTenant<TResult>(
    id: string,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult> {
    return manager.runWithTenant({ id, name: id }, () => tenancy.run(callback));
  }
});

async function installPolicy(
  admin: Knex,
  table: string,
  policy: string,
): Promise<void> {
  await admin.raw(`alter table ${table} enable row level security`);
  await admin.raw(`alter table ${table} force row level security`);
  await admin.raw(`
    create policy ${policy} on ${table}
    using (
      current_setting('tenancyjs.is_central', true) = 'true'
      or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
    )
    with check (
      current_setting('tenancyjs.is_central', true) = 'true'
      or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
    )
  `);
}
