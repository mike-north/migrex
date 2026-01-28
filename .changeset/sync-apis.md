---
"@migrex/files": minor
---

Add synchronous versions of file operations

New synchronous APIs enable blocking file operations for CLI tools, scripts, and tests:
- `loadVersionedFileSync()` - Synchronously load and migrate versioned files
- `saveVersionedFileSync()` - Synchronously save versioned files
- `upgradeVersionedFileSync()` - Synchronously upgrade files in place

**Important**: Sync APIs will throw a `VersionedFileError` if the migration path contains any async migrations (migrations declared with the `async` keyword). Use the async versions (`loadVersionedFile`, `saveVersionedFile`, `upgradeVersionedFile`) when migrations may be asynchronous.

**Use cases:**
- CLI applications that need blocking behavior
- Build scripts and automation tools
- Test fixtures and setup code
