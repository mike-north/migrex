# migrex Dogfooding Journal

## Session Log

### [2026-01-25 15:30] - Initial Setup & Documentation Review

**What I tried:**
- Read through `@migrex/core` README to understand the API surface
- Examined `@migrex/zod` integration to see how schemas are created
- Checked `@migrex/files` to understand config file loading

**What worked:**
- The README for `@migrex/core` is comprehensive and well-structured
- Clear examples showing basic usage, field preservation, and graph analysis
- The Quick Start example is approachable and shows the full workflow

**What didn't work:**
- N/A yet - still in documentation review phase

**Feedback:**
- **Documentation Quality**: The core README is excellent. It covers:
  - Key concepts upfront (Versioned Data Contracts, Bidirectional Migrations, etc.)
  - Quick Start with realistic example (User name splitting)
  - Advanced features (field preservation) with clear examples
  - Graph analysis and troubleshooting sections
- **API Discovery**: The imports are intuitive:
  - `createMigrationGraph` - clearly the main entry point
  - `semverStrategy` - obvious what this does
  - Type imports (`VersionedSchema`, `ReversibleMigration`, `MigrationContext`) - descriptive names
- **Zod Integration**: The `fromZod` helper looks very clean. It wraps a Zod schema and returns a `VersionedSchema`.
- **Files Integration**: The `loadConfig` and `saveConfig` functions are straightforward.

**Questions to explore:**
1. How does the graph know what the "latest" version is for auto-migration?
2. What happens if I try to register the same version twice?
3. How do I handle one-way migrations (vs reversible)?
4. Can I see examples of the ESLint rules in action?

### [2026-01-25 15:35] - Package Setup

**What I tried:**
- Creating the package structure: `packages/example-config/`
- Created package.json with dependencies on `@migrex/core`, `@migrex/zod`, `@migrex/files`
- Set up TypeScript configuration (tsconfig.json, tsconfig.build.json)
- Added API Extractor and tsup config files

**What worked:**
- The package structure is consistent with other packages in the monorepo
- All the standard scripts (`build`, `test`, etc.) are in place
- TypeScript project references look correct

**Feedback:**
- **Setup Complexity**: Setting up a new package requires several configuration files:
  - package.json (expected)
  - tsconfig.json (expected)
  - tsconfig.build.json (for API Extractor - this was new to me)
  - api-extractor.json (expected after reading the rules)
  - tsup.config.ts (build tool config - straightforward)
  - temp/.gitkeep (for API Extractor intermediate files)
- **Good Pattern**: Using `workspace:*` for internal dependencies makes sense
- **Question**: The tsconfig.build.json sets `composite: false` while tsconfig.json sets it to `true`. I assume this is because API Extractor doesn't need project references?

### [2026-01-25 15:40] - Defining the Schema Evolution

**Planning the scenario:**
I'm going to model an application configuration that evolves through 4 versions:

**v1.0.0** (Initial Release):
```typescript
{
  version: '1.0.0',
  appName: string,
  port: number,
  debug: boolean
}
```

**v2.0.0** (Add Structured Logging):
```typescript
{
  version: '2.0.0',
  appName: string,
  port: number,
  debug: boolean,
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error',
    output: 'console' | 'file'
  }
}
```

**v3.0.0** (Refactor Debug Flag + Add Features):
```typescript
{
  version: '3.0.0',
  appName: string,
  port: number,
  verbose: boolean,  // renamed from debug
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error',
    output: 'console' | 'file'
  },
  features: string[]  // new field
}
```

**v4.0.0** (Split Logging and Metrics):
```typescript
{
  version: '4.0.0',
  appName: string,
  port: number,
  verbose: boolean,
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error',
    output: 'console' | 'file'
  },
  metrics: {  // new: extracted from logging context
    enabled: boolean,
    port: number
  },
  features: string[]
}
```

**Next steps:**
- Write the Zod schemas for each version ✓
- Define the migrations ✓
- Test the migration paths
- Try using the files integration

### [2026-01-25 15:50] - Writing Schemas and Migrations

**What I tried:**
- Created `schemas.ts` with 4 versions of config schema using Zod
- Created `migrations.ts` with 3 bidirectional migrations
- Created `index.ts` that exports everything and provides `createConfigGraph()` helper

**What worked:**
- **Zod Integration**: The `fromZod` helper is really clean! Just wrap a Zod schema:
  ```typescript
  export const schemaV1 = fromZod('1.0.0', ConfigV1Schema, {
    releaseDate: '2024-01-01',
  });
  ```
- **Type Safety**: TypeScript infers the types from Zod schemas perfectly with `z.infer`
- **Migration Structure**: The `ReversibleMigration` type is intuitive:
  - `up(data, ctx)` - migrate forward
  - `down(data, ctx)` - migrate backward
- **API Discoverability**: Import names are clear and logical

**Challenges / Questions:**
1. **MigrationContext Usage**: I didn't use `ctx.preserve()` yet. In my scenario, the migrations are simple enough that nothing needs preservation. Should I add a more complex scenario to test this?
2. **Version Literals**: I used `z.literal('1.0.0')` for the version field. Is this the recommended pattern? It provides excellent type safety but feels a bit verbose.
3. **Import Extensions**: Had to use `.js` extensions in imports (e.g., `from './schemas.js'`). This is correct for ESM but takes getting used to.
4. **Default Values**: In migrations, I'm adding fields with sensible defaults. Is there a way to mark these as "data loss" vs "safe default"?

**Feedback:**
- **API Shape**: The core API is elegant. Creating a migration graph is straightforward.
- **Type Safety**: Love that the migration functions are strongly typed with the `<From, To>` generics.
- **Documentation**: I referenced the README examples frequently and they were helpful.

**Next steps:**
- Build the package and see if there are any type errors ✓
- Write tests to exercise the migration paths
- Try the `@migrex/files` integration

### [2026-01-25 16:00] - First Build Attempt

**What I tried:**
- Built the package with `pnpm build`
- Hit TypeScript errors about the API

**What didn't work:**
- **Documentation Out of Sync**: The README shows:
  ```typescript
  const graph = createMigrationGraph(semverStrategy);
  graph.register(schema);
  graph.addMigration(migration);
  ```
- **Actual API**: But the real API is:
  ```typescript
  const graph = createMigrationGraph({
    id: 'example-config',
    versionStrategy: semverStrategy,
  });
  graph.registerSchema(schema);
  graph.registerMigration(migration);
  ```

**What worked:**
- Once I corrected the API calls, TypeScript compiled successfully!
- Build process is fast
- API Extractor generated the API report without issues

**Feedback:**
- **CRITICAL Documentation Issue**: The README Quick Start example uses an outdated API signature. This is a major blocker for first-time users!
  - `createMigrationGraph` takes an options object, not just a strategy
  - Must provide an `id` field (what is this used for?)
  - Methods are `registerSchema` and `registerMigration`, not `register` and `addMigration`
- **Error Messages**: The TypeScript errors were clear enough that I could find the issue:
  - "Property 'versionStrategy' is missing" - told me I need an options object
  - "Property 'register' does not exist" - told me to find the right method name
- **Discovery Process**: I had to read the source code to find the correct API. This should not be necessary!

**Suggestions:**
1. Update the README to match the current API
2. Consider if the old simpler API (`createMigrationGraph(strategy)`) would be better UX
3. Document what the `id` field is used for - is it for telemetry? debugging?

**Next steps:**
- Write tests to verify migrations work correctly ✓
- Test field preservation with a more complex scenario
- Try the files integration

### [2026-01-25 16:10] - Writing Tests

**What I tried:**
- Created comprehensive test suite with 16 test cases
- Tests cover:
  - Individual migrations (v1->v2, v2->v3, v3->v4)
  - Bidirectional migrations (up and down)
  - Multi-step migrations (v1->v4, v4->v1)
  - Round-trip migration
  - Validation error handling
  - Path finding

**What worked:**
- **Test API**: The `graph.migrate<T>()` API is clean and intuitive
- **Type Safety**: TypeScript correctly infers the result type from the generic parameter
- **Result Pattern**: The `{ success: boolean, data?, error? }` pattern is familiar and ergonomic
- **All 16 tests pass!**

**Challenges:**
1. **MigrationResult Error Handling**: I initially tried to access `result.errors` (plural) but it's actually `result.error` (singular). The error message wasn't super helpful here.
2. **Running Tests**: The package-level `pnpm test` command doesn't work because vitest is configured at the workspace level. Had to run `pnpm vitest run` from the root.

**Feedback:**
- **Test Experience**: Overall very smooth! The API is predictable and easy to test.
- **Type Narrowing**: The discriminated union pattern for `MigrationResult` works well:
  ```typescript
  if (result.success) {
    // result.data is available
  } else {
    // result.error is available
  }
  ```
- **Documentation Gap**: It would be helpful to have example tests in the README or a testing guide.

**Observations:**
- The migrations I wrote are all "lossy" in one direction - when you downgrade, you lose new fields. This is expected behavior for this scenario.
- I haven't used field preservation (`ctx.preserve()` / `ctx.consume()`) yet because my migrations are simple. Should I add a more complex scenario?

**Next steps:**
- Try the `@migrex/files` integration to load/save config files ✓
- Consider adding a field preservation scenario
- Try the ESLint plugin

### [2026-01-25 16:15] - Files Integration

**What I tried:**
- Created integration tests using `@migrex/files` package
- Tests covered:
  - Saving and loading config files
  - Auto-migration to latest version
  - Migration to specific target version
  - Error handling (missing files, invalid JSON)
  - Pretty vs compact JSON output
  - Migration path information

**What worked:**
- **Files API is excellent!** The `loadConfig` and `saveConfig` functions are simple and intuitive:
  ```typescript
  await saveConfig(graph, './config.json', data);
  const result = await loadConfig(graph, './config.json');
  ```
- **Auto-migration by default**: This is a smart default! If you don't specify `targetVersion`, it migrates to the latest.
- **Type safety**: The generic parameter on `loadConfig<T>` ensures type safety for the returned data.
- **All 8 integration tests pass!**

**Challenges:**
1. **Default behavior surprise**: I initially expected `loadConfig` without a `targetVersion` to keep the same version. But it auto-migrates to latest, which is actually better for most use cases!
2. **Learning curve**: Had to read the interface documentation to understand the default behavior.

**Feedback:**
- **API Design**: The files integration feels like a natural extension of the core API. It's not trying to be too clever.
- **Result Type**: The `LoadConfigResult` type provides all the information you need:
  - `data` - the actual config
  - `sourceVersion` - what was in the file
  - `targetVersion` - what it was migrated to
  - `wasUpgraded` - boolean flag
  - `migrationPath` - details about the migration steps
- **Error Handling**: Errors are thrown as expected (missing files, invalid JSON). The error messages are clear.

**Observations:**
- The `pretty` option for JSON formatting is a nice touch. Defaults to pretty-printed, which is better for human-readable configs.
- The migration path information is available in the result, which could be useful for logging or debugging.

**Next steps:**
- Add a field preservation scenario to test `ctx.preserve()` / `ctx.consume()` ✓
- Summarize findings

### [2026-01-25 16:20] - Field Preservation

**What I tried:**
- Created a dedicated test suite for field preservation
- Scenario: A "theme" field exists in v1, is removed in v2, then restored in v3
- Used `ctx.preserve()` and `ctx.consume()` to maintain the theme value across migrations
- Wrote 5 test cases covering:
  - Preserving theme v1 -> v2 -> v3
  - Preserving theme v3 -> v2 -> v1 (reverse)
  - Checking preservation metadata
  - Fallback behavior when no preservation exists
  - Detecting unconsumed preserved fields

**What worked:**
- **Preservation API**: The `ctx.preserve()` and `ctx.consume()` API is intuitive:
  ```typescript
  ctx.preserve('theme', data.theme, {
    sourceVersion: '1.0.0',
    description: 'Theme preference is restored in v3',
  });

  const preserved = ctx.consume('theme');
  const theme = preserved?.kind === 'single'
    ? (preserved.value as ThemeType)
    : 'light'; // fallback
  ```
- **Stash Summary**: The `result.stash` object provides excellent visibility:
  - `consumed` - fields that were preserved and used
  - `unconsumed` - fields that were preserved but not used (data loss!)
  - `lossless` - boolean flag indicating if migration was lossless
- **All 5 field preservation tests pass!**

**Challenges:**
1. **Type Naming**: I initially used `fieldName` and `consumedInVersion`, but the actual properties are `path` and `consumedAt`. Had to look at the type definition to find the correct names.
2. **Discriminated Union**: The preserved field uses `kind: 'single' | 'multi'` to discriminate between single values and arrays. This is good for flexibility but requires a type check.

**Feedback:**
- **Powerful Feature**: Field preservation is a killer feature for complex migrations! Being able to temporarily "park" a field and restore it later is invaluable.
- **Metadata**: The `PreservedFieldSummary` includes helpful metadata like `preservedAt`, `consumedAt`, and `history` for debugging.
- **Lossless Detection**: The automatic detection of lossless vs lossy migrations (via the `lossless` flag) is brilliant. It makes it easy to validate that your migrations are working correctly.
- **Documentation Needed**: The field preservation feature is powerful but could use more examples in the README.

**Observations:**
- The `description` field in `preserve()` is great for self-documenting migrations. It explains WHY a field is being preserved.
- The `sourceVersion` field helps document where the field originated.
- The fallback pattern (`preserved?.value ?? defaultValue`) is a common and good pattern.

## Final Summary

### What Went Well

1. **Core API**: The core migration API is clean, well-typed, and intuitive once you understand it.
2. **Zod Integration**: The `fromZod` helper makes schema definition trivial.
3. **Files Integration**: The `loadConfig`/`saveConfig` API is simple and does what you'd expect.
4. **Field Preservation**: A powerful feature for complex migrations that need to maintain data across intermediate versions.
5. **Type Safety**: TypeScript support is excellent throughout. The generic types work as expected.
6. **Test Experience**: Writing tests was straightforward. The API is predictable.

### Critical Issues

1. **Documentation Out of Sync**: The README Quick Start uses an outdated API:
   - Shows: `createMigrationGraph(semverStrategy)`
   - Actual: `createMigrationGraph({ id: 'my-graph', versionStrategy: semverStrategy })`
   - Shows: `graph.register(schema)` and `graph.addMigration(migration)`
   - Actual: `graph.registerSchema(schema)` and `graph.registerMigration(migration)`
   - **This is a major blocker for new users!**

### Suggestions

1. **Update README**: Sync the Quick Start example with the current API immediately.
2. **Document the `id` field**: What is it used for? Telemetry? Debugging? This should be explained.
3. **Simplify API?**: Consider if the old API (`createMigrationGraph(strategy)`) was actually better UX. The `id` field seems required but it's not clear why.
4. **Add Testing Guide**: Include example tests in the docs to help users get started.
5. **Field Preservation Examples**: Add more examples of field preservation to the README.
6. **Property Name Consistency**: Consider renaming `PreservedFieldSummary.path` to `fieldName` for clarity (or document why it's called `path`).

### Overall Assessment

**The migrex library has a solid foundation with an elegant API design.** The core concepts (versioned schemas, bidirectional migrations, field preservation) are well thought out. The integration with Zod and file loading feels natural.

**However, the documentation is critically out of date**, which would prevent first-time users from successfully using the library. Once I figured out the correct API from reading the source code, everything worked smoothly.

**Test Coverage: 29/29 tests passing** across migrations, files integration, and field preservation.

**Recommendation**: Fix the documentation before any release. The library itself is ready, but users will struggle without accurate docs.

**Final Grade: A- for the library, C for the documentation.**

