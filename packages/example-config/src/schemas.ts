/**
 * Schema definitions for application configuration versions
 *
 * This file demonstrates a realistic evolution of a configuration schema
 * through multiple versions, using Zod for validation.
 */

import { z } from 'zod';
import { fromZod } from '@migrex/zod';

// ============================================================================
// Version 1.0.0 - Initial Release
// ============================================================================

export const ConfigV1Schema = z.object({
  version: z.literal('1.0.0'),
  appName: z.string().min(1),
  port: z.number().int().positive(),
  debug: z.boolean(),
});

export type ConfigV1 = z.infer<typeof ConfigV1Schema>;

export const schemaV1 = fromZod('1.0.0', ConfigV1Schema, {
  releaseDate: '2024-01-01',
});

// ============================================================================
// Version 2.0.0 - Add Structured Logging
// ============================================================================

export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  output: z.enum(['console', 'file']),
});

export const ConfigV2Schema = z.object({
  version: z.literal('2.0.0'),
  appName: z.string().min(1),
  port: z.number().int().positive(),
  debug: z.boolean(),
  logging: LoggingConfigSchema,
});

export type ConfigV2 = z.infer<typeof ConfigV2Schema>;

export const schemaV2 = fromZod('2.0.0', ConfigV2Schema, {
  releaseDate: '2024-06-01',
});

// ============================================================================
// Version 3.0.0 - Refactor Debug Flag + Add Features
// ============================================================================

export const ConfigV3Schema = z.object({
  version: z.literal('3.0.0'),
  appName: z.string().min(1),
  port: z.number().int().positive(),
  verbose: z.boolean(), // renamed from 'debug'
  logging: LoggingConfigSchema,
  features: z.array(z.string()),
});

export type ConfigV3 = z.infer<typeof ConfigV3Schema>;

export const schemaV3 = fromZod('3.0.0', ConfigV3Schema, {
  releaseDate: '2024-12-01',
});

// ============================================================================
// Version 4.0.0 - Split Logging and Metrics
// ============================================================================

export const MetricsConfigSchema = z.object({
  enabled: z.boolean(),
  port: z.number().int().positive(),
});

export const ConfigV4Schema = z.object({
  version: z.literal('4.0.0'),
  appName: z.string().min(1),
  port: z.number().int().positive(),
  verbose: z.boolean(),
  logging: LoggingConfigSchema,
  metrics: MetricsConfigSchema,
  features: z.array(z.string()),
});

export type ConfigV4 = z.infer<typeof ConfigV4Schema>;

export const schemaV4 = fromZod('4.0.0', ConfigV4Schema, {
  releaseDate: '2025-03-01',
});
