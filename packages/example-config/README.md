# @migrex/example-config

**This is a temporary dogfooding package to validate the migrex library API and developer experience.**

This package demonstrates a realistic schema migration scenario: an application configuration file that evolves through 4 versions.

## Purpose

This package exists to:
1. Validate the migrex API works as expected
2. Identify API ergonomics issues
3. Test the integration between `@migrex/core`, `@migrex/zod`, and `@migrex/files`
4. Document findings and feedback for improving the library

## Schema Evolution

### v1.0.0 - Initial Release
```typescript
{
  version: '1.0.0',
  appName: string,
  port: number,
  debug: boolean
}
```

### v2.0.0 - Add Structured Logging
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

### v3.0.0 - Refactor Debug Flag + Add Features
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
  features: string[]
}
```

### v4.0.0 - Split Logging and Metrics
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
  metrics: {
    enabled: boolean,
    port: number
  },
  features: string[]
}
```

## Usage

```typescript
import { createConfigGraph, LATEST_VERSION } from '@migrex/example-config';
import type { ConfigV1, ConfigV4 } from '@migrex/example-config';

const graph = createConfigGraph();

// Migrate from v1 to v4
const v1Config: ConfigV1 = {
  version: '1.0.0',
  appName: 'My App',
  port: 3000,
  debug: true,
};

const result = graph.migrate<ConfigV4>(v1Config, '1.0.0', '4.0.0');

if (result.success) {
  console.log(result.data);
  // {
  //   version: '4.0.0',
  //   appName: 'My App',
  //   port: 3000,
  //   verbose: true,
  //   logging: { level: 'debug', output: 'console' },
  //   metrics: { enabled: false, port: 9090 },
  //   features: []
  // }
}
```

## Test Coverage

The package includes 29 comprehensive tests:

### Migrations Tests (16 tests)
- Individual migration steps (v1->v2, v2->v3, v3->v4)
- Bidirectional migrations (up and down)
- Multi-step migrations (v1->v4, v4->v1)
- Round-trip migration validation
- Validation error handling
- Path finding

### Files Integration Tests (8 tests)
- Saving and loading config files
- Auto-migration to latest version
- Migration to specific target version
- Error handling (missing files, invalid JSON)
- Pretty vs compact JSON output
- Migration path information

### Field Preservation Tests (5 tests)
- Preserving fields across intermediate versions
- Bidirectional preservation
- Preservation metadata
- Fallback behavior
- Detecting unconsumed preserved fields

## Key Findings

See [DOGFOOD_JOURNAL.md](./DOGFOOD_JOURNAL.md) for detailed findings and feedback.

**TL;DR:**
- ✅ Core API is elegant and type-safe
- ✅ Zod integration is seamless
- ✅ Files integration works great
- ✅ Field preservation is a killer feature
- ❌ **Critical**: README documentation is out of sync with actual API
- ⚠️ Need to document what the `id` field is used for

## Running Tests

```bash
# From workspace root
pnpm vitest run packages/example-config/test/
```

All 29 tests should pass.

## Future Work

This package can be removed once:
1. The core README is updated with correct API examples
2. Testing documentation is added
3. Field preservation examples are added to the docs
4. The API ergonomics feedback has been reviewed

## License

UNLICENSED - This is an internal validation package
