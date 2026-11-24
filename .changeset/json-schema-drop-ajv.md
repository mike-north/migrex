---
'@migrex/json-schema': major
---

Replace Ajv with `@cfworker/json-schema`

`@migrex/json-schema` no longer depends on `ajv` or `ajv-formats`, so it installs from npm registries that block Ajv.

**Breaking changes:**

- `JsonSchemaPluginOptions.ajvOptions` is removed. Use the new `draft` (`'4' | '7' | '2019-09' | '2020-12'`, default `'7'`) and `allErrors` (default `true`) options instead.
- `JsonSchemaPlugin.ajv` is removed. The plugin exposes `draft` instead.
- Ajv's strict mode is gone: unknown keywords and unknown formats are ignored rather than rejected when a schema is compiled.
- Error `message` text now comes from `@cfworker/json-schema` (for example `Instance type "number" is invalid. Expected "string".`). `code` is still the failing keyword and `path` the instance path.
