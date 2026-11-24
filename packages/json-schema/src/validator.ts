/**
 * Internal adapter between migrex and `@cfworker/json-schema`.
 *
 * Its job is to make the validator behave the way `@migrex/json-schema` behaved on Ajv,
 * where that matters to callers:
 * - schemas are checked when compiled (meta-schema and local `$ref`s), not on first use
 * - `$ref` siblings are honoured in every draft
 * - properties set to `undefined` count as absent
 * - errors name the specific failing keyword and instance path
 *
 * @internal
 */

import { Validator } from '@cfworker/json-schema';
import type { OutputUnit, Schema as CfworkerSchema } from '@cfworker/json-schema';
import type { ValidationError, ValidationResult } from '@migrex/core';
import { draft04MetaSchema, draft07MetaSchema } from './meta-schemas.js';

/**
 * JSON Schema drafts supported by the validator.
 * @public
 */
export type JsonSchemaDraft = '4' | '7' | '2019-09' | '2020-12';

/** Options for {@link compileSchema}. */
interface CompileOptions {
  /** Draft to use when the schema has no recognised `$schema`. */
  draft: JsonSchemaDraft;
  /** Collect every error instead of stopping at the first. */
  allErrors: boolean;
  /** Drop `format` keywords so formats are not checked. */
  stripFormats: boolean;
}

/** A compiled schema. */
export interface CompiledSchema {
  validate<T>(data: unknown): ValidationResult<T>;
}

// ---------------------------------------------------------------------------
// Schema preparation
// ---------------------------------------------------------------------------

/** Keywords whose values are data, not subschemas. Nothing under them is rewritten. */
const DATA_KEYWORDS = new Set(['const', 'enum', 'default', 'examples']);

/** Keywords whose values map names to subschemas. Their keys are names, not keywords. */
const SCHEMA_MAP_KEYWORDS = new Set([
  'properties',
  'patternProperties',
  'definitions',
  '$defs',
  'dependentSchemas',
  'dependencies',
]);

/** Keywords that may sit beside `$ref` without being validation constraints. */
const REF_ANNOTATION_KEYWORDS = new Set([
  '$ref',
  '$id',
  'id',
  '$schema',
  '$comment',
  'title',
  'description',
  'definitions',
  '$defs',
  'default',
  'examples',
]);

const DRAFT_URIS: ReadonlyArray<[RegExp, JsonSchemaDraft]> = [
  [/^https?:\/\/json-schema\.org\/draft-04\/schema#?$/, '4'],
  [/^https?:\/\/json-schema\.org\/draft-0[67]\/schema#?$/, '7'],
  [/^https?:\/\/json-schema\.org\/draft\/2019-09\/schema#?$/, '2019-09'],
  [/^https?:\/\/json-schema\.org\/draft\/2020-12\/schema#?$/, '2020-12'],
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Pick the draft from the schema's `$schema`, falling back to the configured draft. */
function detectDraft(schema: unknown, fallback: JsonSchemaDraft): JsonSchemaDraft {
  if (!isPlainObject(schema) || typeof schema['$schema'] !== 'string') return fallback;
  const uri = schema['$schema'];
  for (const [pattern, draft] of DRAFT_URIS) {
    if (pattern.test(uri)) return draft;
  }
  return fallback;
}

function deepCopy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepCopy);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    // A keyword set to undefined (e.g. `required: undefined`) means "absent", as in JSON.
    if (child !== undefined) out[key] = deepCopy(child);
  }
  return out;
}

/**
 * Deep-copy a schema for the validator, which annotates the object it is given.
 * Optionally drops `format` keywords, and rewrites `$ref` with sibling constraints
 * into `allOf` for drafts where the validator would otherwise ignore the siblings.
 */
function prepareSchema(
  schema: unknown,
  options: { stripFormats: boolean; wrapRefSiblings: boolean }
): unknown {
  const prepareMap = (map: unknown): unknown => {
    if (!isPlainObject(map)) return prepare(map);
    const out: Record<string, unknown> = {};
    for (const [name, child] of Object.entries(map)) out[name] = prepare(child);
    return out;
  };

  const prepare = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(prepare);
    if (!isPlainObject(node)) return node;

    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      if (child === undefined) continue;
      if (options.stripFormats && key === 'format' && typeof child === 'string') continue;
      if (DATA_KEYWORDS.has(key)) out[key] = deepCopy(child);
      else if (SCHEMA_MAP_KEYWORDS.has(key)) out[key] = prepareMap(child);
      else out[key] = prepare(child);
    }

    if (
      options.wrapRefSiblings &&
      typeof out['$ref'] === 'string' &&
      Object.keys(out).some((key) => !REF_ANNOTATION_KEYWORDS.has(key))
    ) {
      const { $ref, ...rest } = out;
      const allOf = Array.isArray(rest['allOf']) ? (rest['allOf'] as unknown[]) : [];
      // Append, so pointers into the existing allOf entries keep their indices.
      return { ...rest, allOf: [...allOf, { $ref }] };
    }
    return out;
  };

  return prepare(schema);
}

// ---------------------------------------------------------------------------
// Compile-time schema checks
// ---------------------------------------------------------------------------

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(root: unknown, location: string): unknown {
  const pointer = location.startsWith('#') ? location.slice(1) : location;
  if (pointer === '') return root;
  let target: unknown = root;
  for (const raw of pointer.split('/').slice(1)) {
    const segment = decodePointerSegment(decodeURIComponent(raw));
    if (Array.isArray(target)) target = target[Number(segment)];
    else if (isPlainObject(target)) target = target[segment];
    else return undefined;
    if (target === undefined) return undefined;
  }
  return target;
}

/**
 * Throw if any `$ref` in the prepared schema does not resolve.
 * Runs after the validator has dereferenced the schema, so `$id` base URIs are honoured.
 */
function checkRefsResolve(prepared: unknown, validator: Validator): void {
  const lookup = (validator as unknown as { lookup: Record<string, unknown> }).lookup;

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isPlainObject(node)) return;
    const annotated = node as { __absolute_ref__?: unknown; __absolute_recursive_ref__?: unknown };
    for (const [ref, absolute] of [
      [node['$ref'], annotated.__absolute_ref__],
      [node['$recursiveRef'], annotated.__absolute_recursive_ref__],
    ] as const) {
      if (typeof ref !== 'string') continue;
      const uri = typeof absolute === 'string' ? absolute : ref;
      if (lookup[uri] === undefined) {
        throw new Error(`Invalid JSON Schema: $ref "${ref}" does not resolve`);
      }
    }
    for (const [key, child] of Object.entries(node)) {
      if (DATA_KEYWORDS.has(key)) continue;
      if (SCHEMA_MAP_KEYWORDS.has(key) && isPlainObject(child)) Object.values(child).forEach(visit);
      else visit(child);
    }
  };

  visit(prepared);
}

let draft04MetaValidator: Validator | undefined;
let draft07MetaValidator: Validator | undefined;

function metaValidatorFor(draft: JsonSchemaDraft): Validator | undefined {
  if (draft === '4') {
    draft04MetaValidator ??= new Validator(
      deepCopy(draft04MetaSchema) as CfworkerSchema,
      '4',
      false
    );
    return draft04MetaValidator;
  }
  if (draft === '7') {
    draft07MetaValidator ??= new Validator(
      deepCopy(draft07MetaSchema) as CfworkerSchema,
      '7',
      false
    );
    return draft07MetaValidator;
  }
  // 2019-09 and 2020-12 meta-schemas span several vocabulary documents; not bundled.
  return undefined;
}

/** Throw if the schema is not valid against its draft's meta-schema. */
function checkAgainstMetaSchema(
  schema: unknown,
  draft: JsonSchemaDraft,
  ignoreFormats: boolean
): void {
  const meta = metaValidatorFor(draft);
  if (!meta) return;
  const result = meta.validate(schema);
  if (result.valid) return;
  let errors = toValidationErrors(result.errors);
  // With formats off, format keywords in the meta-schema (e.g. $id: uri-reference) don't apply.
  if (ignoreFormats) errors = errors.filter((e) => e.code !== 'format');
  if (errors.length === 0) return;
  const details = errors
    .map((e) => `${e.path.length > 0 ? '/' + e.path.join('/') : '(root)'}: ${e.message}`)
    .join('; ');
  throw new Error(`Invalid JSON Schema: ${details}`);
}

// ---------------------------------------------------------------------------
// Validation and error mapping
// ---------------------------------------------------------------------------

/**
 * Keywords whose errors only summarize failures in a subschema.
 * The subschema's own errors are more specific, so these are dropped.
 */
const SUMMARY_KEYWORDS = new Set([
  'properties',
  'patternProperties',
  'items',
  'prefixItems',
  'allOf',
  '$ref',
  '$recursiveRef',
  'dependentSchemas',
  'dependencies',
  'propertyNames',
  'if',
  'then',
  'else',
]);

/**
 * Keywords that apply a subschema to "everything else". Their error is a summary when
 * the subschema reported its own errors, and is the real error when the subschema is `false`.
 */
const REMAINDER_KEYWORDS = new Set([
  'additionalProperties',
  'unevaluatedProperties',
  'additionalItems',
  'unevaluatedItems',
]);
const REMAINDER_ITEM_KEYWORDS = new Set(['additionalItems', 'unevaluatedItems']);

function parentLocation(location: string): string {
  const index = location.lastIndexOf('/');
  return index === -1 ? location : location.slice(0, index);
}

function lastSegment(location: string): string {
  return decodePointerSegment(decodeURIComponent(location.slice(location.lastIndexOf('/') + 1)));
}

/**
 * Convert a validator instance location (e.g. "#/foo/bar/0") to a path array.
 */
function instanceLocationToPath(instanceLocation: string): string[] {
  const pointer = instanceLocation.startsWith('#') ? instanceLocation.slice(1) : instanceLocation;
  if (!pointer) return [];
  return pointer
    .split('/')
    .slice(1)
    .map((segment) => decodePointerSegment(decodeURIComponent(segment)));
}

/**
 * Convert validator output to migrex ValidationErrors, keeping the most specific errors.
 */
function toValidationErrors(errors: OutputUnit[], schemaRoot?: unknown): ValidationError[] {
  // additionalItems only owns items past the tuple; a `false` inside the tuple is its own error.
  const isTupleIndex = (owner: OutputUnit, index: string): boolean => {
    if (schemaRoot === undefined) return false;
    const parentSchema = resolvePointer(schemaRoot, parentLocation(owner.keywordLocation));
    if (!isPlainObject(parentSchema)) return false;
    const tuple = parentSchema['items'] ?? parentSchema['prefixItems'];
    return Array.isArray(tuple) && Number(index) < tuple.length;
  };

  // A `false` subschema reached through additionalProperties (etc.) reports
  // "False boolean schema." Report it as the remainder keyword that rejected it.
  const relabelled = errors.map((error) => {
    if (error.keyword !== 'false') return error;
    const parent = parentLocation(error.instanceLocation);
    const name = lastSegment(error.instanceLocation);
    const owner = errors.find(
      (candidate) =>
        REMAINDER_KEYWORDS.has(candidate.keyword) &&
        candidate.instanceLocation === parent &&
        (REMAINDER_ITEM_KEYWORDS.has(candidate.keyword)
          ? !isTupleIndex(candidate, name)
          : candidate.error.includes(`"${name}"`))
    );
    return owner ? { ...error, keyword: owner.keyword, error: owner.error } : error;
  });

  const hasDescendantError = (error: OutputUnit): boolean =>
    relabelled.some((other) => other.instanceLocation.startsWith(`${error.instanceLocation}/`));

  let specific = relabelled.filter((error) => {
    if (SUMMARY_KEYWORDS.has(error.keyword)) return false;
    if (REMAINDER_KEYWORDS.has(error.keyword) && hasDescendantError(error)) return false;
    return true;
  });
  if (specific.length === 0) specific = relabelled;

  return specific.map((error) => ({
    path: instanceLocationToPath(error.instanceLocation),
    message: error.error,
    code: error.keyword,
  }));
}

/**
 * Prepare data for validation the way Ajv saw it: object properties set to
 * `undefined` are absent (so `required` reports them as missing).
 * Returns the input itself when nothing needs changing, so clean data is not copied.
 * Cycles are left as they are; the validator only descends where the schema does.
 */
function normalizeData(value: unknown, inProgress = new WeakSet()): unknown {
  if (typeof value !== 'object' || value === null || value instanceof Date) return value;
  if (inProgress.has(value)) return value;
  inProgress.add(value);

  try {
    if (Array.isArray(value)) {
      let copy: unknown[] | undefined;
      value.forEach((child: unknown, index) => {
        const next = normalizeData(child, inProgress);
        if (next !== child) {
          copy ??= value.slice();
          copy[index] = next;
        }
      });
      return copy ?? value;
    }

    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) {
        changed = true;
        continue;
      }
      const next = normalizeData(child, inProgress);
      if (next !== child) changed = true;
      out[key] = next;
    }
    return changed ? out : value;
  } finally {
    inProgress.delete(value);
  }
}

/** Normalize data, falling back to the raw value if it is nested too deeply to walk. */
function safeNormalizeData(value: unknown): unknown {
  try {
    return normalizeData(value);
  } catch (cause) {
    if (cause instanceof RangeError) return value;
    throw cause;
  }
}

/** Errors the validator throws for values JSON cannot represent. */
const UNREPRESENTABLE_VALUE = /^Instances of ".*" type are not supported\.$|^URI malformed$/;

/**
 * Compile a JSON Schema.
 * @throws Error if the schema is invalid against its draft's meta-schema, or a `$ref` does not resolve.
 */
export function compileSchema(schema: unknown, options: CompileOptions): CompiledSchema {
  const clean = deepCopy(schema);
  const draft = detectDraft(clean, options.draft);
  checkAgainstMetaSchema(clean, draft, options.stripFormats);

  const prepared = prepareSchema(clean, {
    stripFormats: options.stripFormats,
    wrapRefSiblings: draft === '4' || draft === '7',
  });
  const validator = new Validator(prepared as CfworkerSchema, draft, !options.allErrors);
  checkRefsResolve(prepared, validator);

  return {
    validate<T>(data: unknown): ValidationResult<T> {
      let result: ReturnType<Validator['validate']>;
      try {
        result = validator.validate(safeNormalizeData(data));
      } catch (cause) {
        // The validator throws for values JSON cannot represent (undefined, BigInt,
        // functions) and for malformed keys. Report those as validation failures;
        // anything else is a real fault and propagates.
        const reason = cause instanceof Error ? cause.message : String(cause);
        if (!UNREPRESENTABLE_VALUE.test(reason)) throw cause;
        return {
          success: false,
          errors: [{ path: [], message: `Value cannot be validated: ${reason}`, code: 'type' }],
        };
      }
      if (!result.valid) {
        return { success: false, errors: toValidationErrors(result.errors, prepared) };
      }
      return { success: true, data: data as T };
    },
  };
}
