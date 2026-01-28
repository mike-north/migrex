---
"@migrex/files": minor
---

Add YAML and TOML file format support with automatic format detection

The package now supports YAML (.yaml, .yml) and TOML (.toml) file formats in addition to JSON. File format is automatically detected from the file extension, or can be explicitly specified via the `format` option in all file operations (load, save, upgrade, watch).

**New dependencies:**
- `js-yaml` for YAML parsing and serialization
- `smol-toml` for TOML parsing and serialization

**Security improvements:**
- YAML parsing uses JSON_SCHEMA mode to prevent type coercion issues (e.g., `yes`/`no` becoming booleans) and avoid code execution from custom YAML tags

**Format-specific behavior:**
- JSON: Supports pretty-printing via the `pretty` option
- YAML: Uses safe parsing mode with JSON schema for consistent behavior
- TOML: Requires data to be an object (arrays and primitives at root level are not supported by the TOML spec)

**Breaking changes:** None. The API remains backward compatible.
