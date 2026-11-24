---
'@migrex/json-schema': major
---

Replace Ajv with `@cfworker/json-schema`

`@migrex/json-schema` no longer depends on `ajv` or `ajv-formats`, so it installs from npm registries that block Ajv.

**Breaking changes:**

- `JsonSchemaPluginOptions.ajvOptions` is removed. Use the new `draft` (`'4' | '7' | '2019-09' | '2020-12'`, default `'7'`) and `allErrors` (default `true`) options instead. A recognised `$schema` URI in a schema overrides `draft`.
- `JsonSchemaPlugin.ajv` is removed. The plugin exposes `draft` instead.
- Ajv's strict mode is gone: unknown keywords and unknown formats are ignored rather than rejected.
- Schemas are still checked when compiled, but only against the draft-04 and draft-07 meta-schemas and every `$ref` must resolve (remote schemas are not fetched). Draft 2019-09 and 2020-12 schemas are not meta-validated.
- Error `message` text now comes from `@cfworker/json-schema` (for example `Instance type "number" is invalid. Expected "string".`). `code` is still the failing keyword. For `additionalProperties: false` and `additionalItems: false`, `path` now points at the offending property or item instead of its parent.
- Values JSON cannot represent (`undefined` at the root, `BigInt`, functions) produce a validation error with `code: 'type'` instead of throwing. Object properties set to `undefined` are treated as absent, as before.
- `NaN` and `Infinity` now pass `type: 'number'`. Ajv rejected them.
