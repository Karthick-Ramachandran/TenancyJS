export type TenantDiscriminatorDecision =
  | Readonly<{ kind: "preserve" }>
  | Readonly<{ kind: "inject"; value: string }>
  | Readonly<{ kind: "reject" }>;

export function decideTenantDiscriminator(
  activeTenantId: string | undefined,
  operation: "create" | "update",
  fieldPresent: boolean,
  supplied: unknown,
): TenantDiscriminatorDecision {
  if (activeTenantId === undefined) return Object.freeze({ kind: "preserve" });
  if (operation === "update") {
    return Object.freeze({ kind: fieldPresent ? "reject" : "preserve" });
  }
  if (fieldPresent && supplied !== undefined && supplied !== activeTenantId) {
    return Object.freeze({ kind: "reject" });
  }
  return Object.freeze({ kind: "inject", value: activeTenantId });
}
