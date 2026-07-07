import { describe, expect, it, vi } from "vitest";

import {
  createPostgresDatabaseProvisioner,
  createPostgresSchemaProvisioner,
  type PostgresAdminConnection,
} from "../src/index.js";

function recordingAdmin(rows: readonly unknown[] = []): {
  admin: PostgresAdminConnection;
  calls: { sql: string; params?: readonly unknown[] }[];
} {
  const calls: { sql: string; params?: readonly unknown[] }[] = [];
  const admin: PostgresAdminConnection = {
    query: vi.fn(async (sql: string, params?: readonly unknown[]) => {
      calls.push({ sql, ...(params === undefined ? {} : { params }) });
      return { rows };
    }),
  };
  return { admin, calls };
}

describe("createPostgresSchemaProvisioner", () => {
  it("creates and drops the tenant schema idempotently", async () => {
    const { admin, calls } = recordingAdmin();
    const provisioner = createPostgresSchemaProvisioner({
      admin,
      schema: (tenant) => `tenant_${tenant.id}`,
    });

    await provisioner.provision!({ id: "acme" });
    await provisioner.deprovision!({ id: "acme" });

    expect(calls[0]!.sql).toBe('create schema if not exists "tenant_acme"');
    expect(calls[1]!.sql).toBe('drop schema if exists "tenant_acme" cascade');
  });

  it("delegates migrate to the host callback with the placement", async () => {
    const { admin } = recordingAdmin();
    const migrate = vi.fn(async () => {});
    const provisioner = createPostgresSchemaProvisioner({
      admin,
      schema: (tenant) => `tenant_${tenant.id}`,
      migrate,
    });
    await provisioner.migrate!({ id: "acme" });
    expect(migrate).toHaveBeenCalledWith(
      { id: "acme" },
      { schema: "tenant_acme" },
    );
  });

  it("exposes no migrate hook when none is supplied", () => {
    const { admin } = recordingAdmin();
    const provisioner = createPostgresSchemaProvisioner({
      admin,
      schema: (tenant) => tenant.id,
    });
    expect(provisioner.migrate).toBeUndefined();
  });

  it("rejects a non-identifier schema name before any SQL runs", async () => {
    const { admin, calls } = recordingAdmin();
    const provisioner = createPostgresSchemaProvisioner({
      admin,
      schema: () => 'evil"; drop schema public; --',
    });
    await expect(provisioner.provision!({ id: "x" })).rejects.toThrow(
      /valid SQL identifier/,
    );
    expect(calls).toHaveLength(0);
  });
});

describe("createPostgresDatabaseProvisioner", () => {
  it("creates the database only when it does not already exist", async () => {
    const { admin, calls } = recordingAdmin([]); // pg_database check returns no rows
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: (tenant) => `tenant_${tenant.id}`,
    });
    await provisioner.provision!({ id: "acme" });
    expect(calls[0]!.sql).toContain("from pg_database where datname = $1");
    expect(calls[0]!.params).toEqual(["tenant_acme"]);
    expect(calls[1]!.sql).toBe('create database "tenant_acme"');
  });

  it("is a no-op when the database already exists", async () => {
    const { admin, calls } = recordingAdmin([{ "?column?": 1 }]);
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: (tenant) => `tenant_${tenant.id}`,
    });
    await provisioner.provision!({ id: "acme" });
    expect(calls).toHaveLength(1); // only the existence check, no CREATE
  });

  it("delegates migrate to the host callback with the database placement", async () => {
    const { admin } = recordingAdmin();
    const migrate = vi.fn(async () => {});
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: (tenant) => `tenant_${tenant.id}`,
      migrate,
    });
    await provisioner.migrate!({ id: "acme" });
    expect(migrate).toHaveBeenCalledWith(
      { id: "acme" },
      { database: "tenant_acme" },
    );
  });

  it("drops the database with force", async () => {
    const { admin, calls } = recordingAdmin();
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: (tenant) => `tenant_${tenant.id}`,
    });
    await provisioner.deprovision!({ id: "acme" });
    expect(calls[0]!.sql).toBe(
      'drop database if exists "tenant_acme" with (force)',
    );
  });

  it("treats a result with no rows shape as absent and creates", async () => {
    const query = vi.fn(async () => undefined);
    const provisioner = createPostgresDatabaseProvisioner({
      admin: { query },
      database: () => "tenant_acme",
    });
    await provisioner.provision!({ id: "acme" });
    expect(query).toHaveBeenLastCalledWith('create database "tenant_acme"');
  });

  it("rejects a non-identifier database name before any SQL runs", async () => {
    const { admin, calls } = recordingAdmin();
    const provisioner = createPostgresDatabaseProvisioner({
      admin,
      database: () => "has spaces",
    });
    await expect(provisioner.provision!({ id: "x" })).rejects.toThrow(
      /valid SQL identifier/,
    );
    expect(calls).toHaveLength(0);
  });
});
