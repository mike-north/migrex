---
"@migrex/ts-plugin": patch
"@migrex/eslint-plugin": patch
"@migrex/cli": patch
---

Fix ts-plugin loadAnalysis() implementation and add documentation

## Bug Fixes

- **@migrex/ts-plugin**: Fix `loadAnalysis()` function that was returning undefined, making the plugin non-functional. The plugin now properly loads migration graphs and provides diagnostics, hover info, and quick fixes.

## Documentation

- **@migrex/eslint-plugin**: Add comprehensive README with installation, configuration, and rule documentation
- **@migrex/cli**: Add comprehensive README with all commands, options, and exit codes documented
- Add AI_ASSISTANT_INSTRUCTIONS.md with detailed guidance for AI coding assistants working with migrex
