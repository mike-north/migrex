---
"@migrex/core": patch
"@migrex/files": patch
"@migrex/rest": patch
"@migrex/zod": patch
---

Improve documentation based on DX evaluation feedback

- **@migrex/core**: Add StashSummary type documentation and round-trip migration example
- **@migrex/files**: Clarify loadVersionedFile auto-migration behavior with examples
- **@migrex/rest**: Add "Request vs Response Schemas" section explaining the two-graph pattern for REST APIs with different request/response shapes
- **@migrex/zod**: Document Zod v3.x version requirement and update peerDependencies to explicitly exclude v4.x
