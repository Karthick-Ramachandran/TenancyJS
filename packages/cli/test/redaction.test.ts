import { describe, expect, it } from "vitest";

import { redactData, redactText } from "../src/redaction.js";

describe("redactText", () => {
  it("strips URL credentials and key=value secrets", () => {
    expect(redactText("postgres://user:pw@host/db")).toContain("[REDACTED]@");
    expect(redactText("password=hunter2")).toBe("password=[REDACTED]");
  });
});

describe("redactData (structural)", () => {
  it("redacts secret-named keys wholesale, regardless of value shape", () => {
    const redacted = redactData({
      id: "acme",
      plan: "pro",
      password: "hunter2",
      token: "tok_abc",
      apiKey: "key_xyz",
      databaseUrl: "postgres://u:p@h/db",
      connectionString: "anything",
    }) as Record<string, unknown>;
    expect(redacted.id).toBe("acme");
    expect(redacted.plan).toBe("pro");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    expect(redacted.databaseUrl).toBe("[REDACTED]");
    expect(redacted.connectionString).toBe("[REDACTED]");
  });

  it("recurses into nested objects and arrays", () => {
    const redacted = redactData({
      placement: { secret: "s", region: "us" },
      tenants: [{ id: "a", token: "t" }],
    }) as {
      placement: Record<string, unknown>;
      tenants: Record<string, unknown>[];
    };
    expect(redacted.placement.secret).toBe("[REDACTED]");
    expect(redacted.placement.region).toBe("us");
    expect(redacted.tenants[0]!.id).toBe("a");
    expect(redacted.tenants[0]!.token).toBe("[REDACTED]");
  });

  it("still strips credentials embedded in surviving string values", () => {
    const redacted = redactData({
      note: "connect to postgres://u:pw@host/db please",
    }) as Record<string, string>;
    expect(redacted.note).toContain("[REDACTED]@");
    expect(redacted.note).not.toContain("pw@host");
  });

  it("passes primitives through unchanged", () => {
    expect(redactData(42)).toBe(42);
    expect(redactData(null)).toBe(null);
    expect(redactData(true)).toBe(true);
  });

  it("survives a round-trip through JSON.stringify without leaking a bare secret", () => {
    const json = JSON.stringify(redactData({ password: "hunter2", id: "x" }));
    expect(json).not.toContain("hunter2");
    expect(json).toContain("[REDACTED]");
  });
});
