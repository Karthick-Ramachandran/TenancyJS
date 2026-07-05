# Review: Mongoose Mongodb

## Status

Implementation review passed locally.

## Findings

- ADR-0026 explicitly distinguishes adapter-enforced row filters from database-enforced isolation.
- Protected lean values avoid live-document/model escape; native Mongoose remains private.
- Replica-set transactions are required and do not by themselves strengthen the tenant filter tier.
- Architecture: database routing uses the shared bounded cache and tenant-bound model-name resolution;
  it does not create a second Mongoose cache implementation.
- Security: tenant resources are replica-set validated on first lease, placement collisions fail before
  callback execution, native connections/models/sessions remain private, and returned values stay lean.
- Isolation evidence: the real MongoDB suite creates the same `_id` in two databases, proves tenant-A
  mutation leaves tenant B unchanged, and rejects two tenants mapped to one placement key.
- Guarantee review: database routing becomes MongoDB-authorized only with database-restricted
  credentials; shared credentials provide protected routing/storage separation, not server-side denial.
- Quality: the full 587-test gate, package consumers, coverage floors, audit gate, and Persist Doctor
  pass locally.
