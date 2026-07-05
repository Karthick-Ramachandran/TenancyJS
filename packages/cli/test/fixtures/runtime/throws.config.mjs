// Simulates a config whose top-level code fails (e.g. a bad connection string).
throw new Error("boom while loading config for postgres://user:secret@db:5432");
