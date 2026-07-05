import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runCli, type CliIo } from "../src/index.js";
import { formatTenantList, formatTenantShow } from "../src/output.js";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      cwd: FIXTURES,
      writeStdout: (value) => stdout.push(value),
      writeStderr: (value) => stderr.push(value),
    },
  };
}

describe("runCli tenant list", () => {
  it("prints tenants from the store and exits 0", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "list", "--config", "store-full.config.mjs"],
      output.io,
    );
    expect(code).toBe(0);
    const text = output.stdout.join("");
    expect(text).toContain("acme");
    expect(text).toContain("globex");
    expect(text).toContain("2 tenants.");
  });

  it("redacts secrets in placement fields", async () => {
    const output = captureIo();
    await runCli(
      ["tenant", "list", "--config", "store-full.config.mjs", "--json"],
      output.io,
    );
    const text = output.stdout.join("");
    expect(text).toContain("[REDACTED]");
    expect(text).not.toContain("s3cr3t");
  });

  it("reports a clear error when the store cannot list", async () => {
    const output = captureIo();
    // valid.config.mjs has list, so use factory (no store) to hit the guard.
    const code = await runCli(
      ["tenant", "list", "--config", "factory.config.mjs"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/needs a tenant store/);
  });
});

describe("runCli tenant show", () => {
  it("prints a single tenant as a block", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "show", "acme", "--config", "store-full.config.mjs"],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain("id: acme");
  });

  it("requires an id", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "show", "--config", "store-full.config.mjs"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/requires <id>/);
  });

  it("errors when no tenant matches", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "show", "nobody", "--config", "store-full.config.mjs"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/No tenant found/);
  });
});

describe("runCli tenant create/suspend/activate", () => {
  it("creates a tenant with --set fields", async () => {
    const output = captureIo();
    const code = await runCli(
      [
        "tenant",
        "create",
        "acme",
        "--set",
        "slug=acme-inc",
        "--set",
        "plan=pro",
        "--config",
        "store-writable.config.mjs",
      ],
      output.io,
    );
    expect(code).toBe(0);
    const text = output.stdout.join("");
    expect(text).toContain('Tenant "acme" created.');
    expect(text).toContain("slug=acme-inc");
    expect(text).toContain("plan=pro");
  });

  it("creates a tenant with a store-generated id when none is given", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "create", "--config", "store-writable.config.mjs", "--json"],
      output.io,
    );
    expect(code).toBe(0);
    expect(output.stdout.join("")).toContain("generated-1");
  });

  it("suspends and activates a tenant", async () => {
    const suspend = captureIo();
    expect(
      await runCli(
        ["tenant", "suspend", "seed", "--config", "store-writable.config.mjs"],
        suspend.io,
      ),
    ).toBe(0);
    expect(suspend.stdout.join("")).toContain('Tenant "seed" suspended.');

    const activate = captureIo();
    expect(
      await runCli(
        ["tenant", "activate", "seed", "--config", "store-writable.config.mjs"],
        activate.io,
      ),
    ).toBe(0);
    expect(activate.stdout.join("")).toContain('Tenant "seed" activated.');
  });

  it("requires an id for suspend", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "suspend", "--config", "store-writable.config.mjs"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/suspend requires <id>/);
  });

  it("rejects a malformed --set pair", async () => {
    const output = captureIo();
    const code = await runCli(
      ["tenant", "create", "acme", "--set", "novalue"],
      output.io,
    );
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/--set expects key=value/);
  });

  it("rejects --set outside tenant commands", async () => {
    const output = captureIo();
    const code = await runCli(["doctor", "--set", "a=b"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/--set is valid only/);
  });
});

describe("runCli tenant argument handling", () => {
  it("rejects an unknown subcommand", async () => {
    const output = captureIo();
    const code = await runCli(["tenant", "frobnicate"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/Unknown tenant subcommand/);
  });

  it("rejects --config on non-tenant commands", async () => {
    const output = captureIo();
    const code = await runCli(["doctor", "--config", "x.ts"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/--config is valid only/);
  });

  it("documents tenant commands in help", async () => {
    const output = captureIo();
    await runCli(["help"], output.io);
    expect(output.stdout.join("")).toContain("tenant list");
  });

  it("rejects an unexpected positional on a non-tenant command", async () => {
    const output = captureIo();
    const code = await runCli(["doctor", "stray"], output.io);
    expect(code).toBe(2);
    expect(output.stderr.join("")).toMatch(/Unexpected argument/);
  });
});

describe("tenant output formatting", () => {
  it("renders an empty list distinctly", () => {
    expect(
      formatTenantList({
        schemaVersion: 1,
        command: "tenant",
        subcommand: "list",
        count: 0,
        tenants: [],
      }),
    ).toBe("No tenants found.\n");
  });

  it("uses the singular noun for a single tenant", () => {
    expect(
      formatTenantList({
        schemaVersion: 1,
        command: "tenant",
        subcommand: "list",
        count: 1,
        tenants: [{ id: "solo" }],
      }),
    ).toContain("1 tenant.");
  });

  it("summarises complex fields without dumping them", () => {
    const text = formatTenantShow({
      schemaVersion: 1,
      command: "tenant",
      subcommand: "show",
      tenant: {
        id: "acme",
        active: true,
        regions: ["us", "eu"],
        meta: { tier: "gold" },
        parent: null,
      },
    });
    expect(text).toContain("active=true");
    expect(text).toContain("regions=[2 item(s)]");
    expect(text).toContain("meta={…}");
    expect(text).toContain("parent=null");
  });
});
