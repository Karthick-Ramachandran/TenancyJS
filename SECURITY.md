# Security Policy

TenancyJS handles tenant-isolation boundaries. Please do not report suspected vulnerabilities in a
public issue or discussion.

## Reporting

Use GitHub's private vulnerability reporting for this repository when available. Include:

- the affected package, version, framework, ORM, and isolation strategy;
- a minimal reproduction using synthetic data;
- the expected boundary and observed cross-tenant behavior;
- whether credentials, tenant data, or destructive operations are involved.

Do not include production credentials or customer data. Maintainers will acknowledge a complete
report, assess severity, coordinate a fix, and publish remediation guidance when appropriate. Formal
response-time guarantees will be added before the first stable release.

## Supported versions

TenancyJS is pre-alpha and has no supported npm release yet. Once releases begin, this section will
list maintained versions and security backport policy.

## Security boundaries

TenancyJS provides tenant resolution, context propagation, and adapter isolation. It does not replace
application authentication, tenant membership authorization, encryption, transport security, or
database access control. See `docs/20-security/SECURITY_MODEL.md` and
`docs/20-security/THREAT_MODEL.md`.
