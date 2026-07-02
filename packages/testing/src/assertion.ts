export class TenancyContractAssertionError extends Error {
  readonly code = "TENANCY_CONTRACT_ASSERTION";
  readonly caseName: string;

  constructor(caseName: string, message: string) {
    super(`${caseName}: ${message}`);
    this.name = new.target.name;
    this.caseName = caseName;
  }
}

export function assertContract(
  caseName: string,
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new TenancyContractAssertionError(caseName, message);
}
