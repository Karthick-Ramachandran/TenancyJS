# Changesets

Add a changeset for every user-visible package change:

```bash
pnpm changeset
```

Use `patch` for compatible fixes, `minor` for compatible features before 1.0, and `major` for breaking
changes. Documentation-only and repository-internal changes do not require a changeset.
