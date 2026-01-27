/**
 * Migration helper functions for common data transformation patterns.
 *
 * These helpers reduce boilerplate for typical schema evolution scenarios:
 * - {@link addField} - Add a field with a default value
 * - {@link removeField} - Remove a field (optionally preserving it in stash)
 * - {@link renameField} - Rename a field while preserving its value
 * - {@link restructure} - Transform between flat and nested structures
 *
 * @packageDocumentation
 */
export { addField, type AddFieldOptions } from './add-field.js';
export { removeField, type RemoveFieldOptions } from './remove-field.js';
export { renameField, type RenameFieldOptions } from './rename-field.js';
export { restructure, type RestructureOptions } from './restructure.js';
//# sourceMappingURL=index.d.ts.map