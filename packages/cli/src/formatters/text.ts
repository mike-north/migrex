/**
 * Text formatter for human-readable CLI output.
 *
 * @packageDocumentation
 */

import type {
  AnalysisResult,
  Diagnostic,
  LossyPathReport,
  DeprecatedVersionInfo,
  MigrationSuggestion,
  MigrationPath,
} from '@migrex/core';

/**
 * Format an analysis result as human-readable text.
 * @public
 */
export function formatAnalysisText(analysis: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('=== Migration Graph Analysis ===');
  lines.push('');

  // Metadata
  lines.push('Metadata:');
  lines.push(`  Versions: ${analysis.metadata.versionCount}`);
  lines.push(`  Migrations: ${analysis.metadata.migrationCount}`);
  lines.push(`  Paths analyzed: ${analysis.metadata.pathsAnalyzed}`);
  lines.push(
    `  Computed at: ${new Date(analysis.metadata.computedAt).toISOString()}`
  );
  lines.push('');

  // Connectivity
  lines.push('Connectivity:');
  lines.push(
    `  Fully connected: ${analysis.connectivity.fullyConnected ? 'Yes' : 'No'}`
  );
  lines.push(`  Components: ${analysis.connectivity.components.length}`);

  if (analysis.connectivity.components.length > 1) {
    lines.push('  Disconnected components:');
    analysis.connectivity.components.forEach((component, index) => {
      lines.push(`    ${index + 1}. [${component.join(', ')}]`);
    });
  }

  if (analysis.connectivity.unreachablePairs.length > 0) {
    lines.push('  Sample unreachable pairs:');
    analysis.connectivity.unreachablePairs.forEach((pair) => {
      lines.push(`    ${pair.from} → ${pair.to}`);
    });
  }
  lines.push('');

  // Field profiles
  const profiles = Object.entries(analysis.profiles);
  lines.push('Field Profiles:');
  if (profiles.length === 0) {
    lines.push('  (no preserved fields)');
  } else {
    const multiFields = profiles.filter(([, p]) => p === 'sometimes-multi');
    const singleFields = profiles.filter(([, p]) => p === 'always-single');

    if (multiFields.length > 0) {
      lines.push(`  Sometimes-multi (${multiFields.length}):`);
      multiFields.forEach(([field]) => {
        lines.push(`    - ${field}`);
      });
    }

    if (singleFields.length > 0) {
      lines.push(`  Always-single (${singleFields.length}):`);
      singleFields.forEach(([field]) => {
        lines.push(`    - ${field}`);
      });
    }
  }
  lines.push('');

  // Diagnostics
  const errors = analysis.diagnostics.filter((d) => d.severity === 'error');
  const warnings = analysis.diagnostics.filter((d) => d.severity === 'warning');
  const infos = analysis.diagnostics.filter((d) => d.severity === 'info');

  lines.push('Diagnostics:');
  lines.push(
    `  Errors: ${errors.length}, Warnings: ${warnings.length}, Info: ${infos.length}`
  );

  if (errors.length > 0) {
    lines.push('');
    lines.push('  Errors:');
    errors.forEach((d) => lines.push(`    - ${formatDiagnostic(d)}`));
  }

  if (warnings.length > 0) {
    lines.push('');
    lines.push('  Warnings:');
    warnings.forEach((d) => lines.push(`    - ${formatDiagnostic(d)}`));
  }

  if (infos.length > 0) {
    lines.push('');
    lines.push('  Info:');
    infos.forEach((d) => lines.push(`    - ${formatDiagnostic(d)}`));
  }

  return lines.join('\n');
}

/**
 * Format a single diagnostic message.
 */
function formatDiagnostic(diagnostic: Diagnostic): string {
  const parts: string[] = [];

  if (diagnostic.location) {
    parts.push(
      `[${diagnostic.location.file}:${diagnostic.location.line}:${diagnostic.location.column}]`
    );
  }

  parts.push(`${diagnostic.code}: ${diagnostic.message}`);

  return parts.join(' ');
}

/**
 * Format a lossy path report as human-readable text.
 * @public
 */
export function formatLossyPathsText(report: LossyPathReport): string {
  const lines: string[] = [];

  lines.push('=== Lossy Paths Report ===');
  lines.push('');
  lines.push(`Total version pairs: ${report.totalVersionPairs}`);
  lines.push(`Lossy pairs: ${report.lossyPairCount}`);
  lines.push(`Unreachable pairs: ${report.unreachablePairCount}`);
  lines.push('');

  if (report.lossyPairs.length === 0) {
    lines.push('No lossy paths found.');
  } else {
    lines.push('Lossy paths:');
    report.lossyPairs.forEach((pair) => {
      lines.push(`  ${pair.from} → ${pair.to}:`);

      if (!pair.analysis.pathExists) {
        lines.push('    No path exists');
      } else if (pair.analysis.isLossy) {
        lines.push('    Lossy steps:');
        pair.analysis.lossySteps.forEach((step) => {
          lines.push(
            `      ${step.from} → ${step.to} (${step.direction}): ${step.reason}`
          );
        });
      }
    });
  }

  return lines.join('\n');
}

/**
 * Format migration suggestions as human-readable text.
 * @public
 */
export function formatSuggestionsText(
  suggestions: readonly MigrationSuggestion[]
): string {
  const lines: string[] = [];

  lines.push('=== Migration Suggestions ===');
  lines.push('');

  if (suggestions.length === 0) {
    lines.push('No suggestions.');
  } else {
    suggestions.forEach((suggestion, index) => {
      lines.push(`${index + 1}. ${suggestion.from} → ${suggestion.to}`);
      lines.push(`   Reason: ${suggestion.reason}`);
      lines.push(
        `   Current path length: ${suggestion.currentPathLength === -1 ? 'No path' : suggestion.currentPathLength}`
      );

      if (suggestion.currentLoss && suggestion.currentLoss.length > 0) {
        lines.push(`   Lost fields: ${suggestion.currentLoss.join(', ')}`);
      }

      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Format deprecated version info as human-readable text.
 * @public
 */
export function formatDeprecatedVersionsText(
  versions: readonly DeprecatedVersionInfo[]
): string {
  const lines: string[] = [];

  lines.push('=== Deprecated Versions ===');
  lines.push('');

  if (versions.length === 0) {
    lines.push('No deprecated versions.');
  } else {
    versions.forEach((info) => {
      lines.push(`${info.version}:`);
      lines.push(`  Since: ${info.deprecated.since}`);
      lines.push(`  Successor: ${info.deprecated.successor}`);

      if (info.deprecated.deadline) {
        lines.push(`  Deadline: ${info.deprecated.deadline}`);
      }

      if (info.deprecated.message) {
        lines.push(`  Message: ${info.deprecated.message}`);
      }

      if (info.usedInPaths.length > 0) {
        lines.push(
          `  Used in ${info.usedInPaths.length} path${info.usedInPaths.length === 1 ? '' : 's'}:`
        );
        info.usedInPaths.slice(0, 5).forEach((path) => {
          lines.push(
            `    ${path.from} → ${path.to} (${path.steps} step${path.steps === 1 ? '' : 's'})`
          );
        });

        if (info.usedInPaths.length > 5) {
          lines.push(`    ... and ${info.usedInPaths.length - 5} more`);
        }
      }

      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Format a migration path as human-readable text.
 * @public
 */
export function formatMigrationPath(path: MigrationPath): string {
  const lines: string[] = [];

  if (path.steps.length === 0) {
    lines.push('Path: (no steps - same version)');
    return lines.join('\n');
  }

  // At this point, path.steps is guaranteed to have at least one element
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const from = path.steps[0]!.fromVersion;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const to = path.steps[path.steps.length - 1]!.toVersion;

  lines.push(`Path from ${from} to ${to}:`);
  lines.push(`  Steps: ${path.steps.length}`);
  lines.push('');

  path.steps.forEach((step, index) => {
    const arrow = step.direction === 'up' ? '→' : '←';
    lines.push(
      `  ${index + 1}. ${step.fromVersion} ${arrow} ${step.toVersion} (${step.direction})`
    );

    // Show traits
    const migration = step.migration;
    const traits: string[] = [];

    // Access traits based on direction
    if (migration.traits) {
      // Try to get the traits for the current direction
      const upTraits = 'up' in migration.traits ? migration.traits.up : undefined;
      const downTraits =
        'down' in migration.traits ? migration.traits.down : undefined;

      const directionTraits =
        step.direction === 'up' ? upTraits : downTraits ?? upTraits;

      if (directionTraits) {
        if (directionTraits.lossy) traits.push('lossy');
        if (directionTraits.restructures) traits.push('restructures');
        if (directionTraits.semanticShift) traits.push('semantic-shift');
        if (directionTraits.precisionLoss) traits.push('precision-loss');
        if (directionTraits.normalizes) traits.push('normalizes');
      }
    }

    if (traits.length > 0) {
      lines.push(`     Traits: ${traits.join(', ')}`);
    }
  });

  return lines.join('\n');
}
