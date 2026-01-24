import type { MigrationPath } from '../types.js';

/**
 * Result of analyzing a migration graph.
 * Provides comprehensive information about field preservation patterns,
 * connectivity between versions, and potential issues.
 */
export interface AnalysisResult {
  /** Field preservation profiles across all migration paths */
  profiles: FieldProfileMap;
  /** Detected issues, warnings, and informational messages */
  diagnostics: readonly Diagnostic[];
  /** Graph connectivity analysis results */
  connectivity: ConnectivityAnalysis;
  /** Analysis metadata and statistics */
  metadata: {
    /** Total number of versions in the graph */
    versionCount: number;
    /** Total number of migrations in the graph */
    migrationCount: number;
    /** Number of version-to-version paths analyzed */
    pathsAnalyzed: number;
    /** Timestamp when analysis was computed (milliseconds since epoch) */
    computedAt: number;
  };
}

/**
 * Profile describing how a field behaves across migration paths.
 *
 * - `always-single`: Field is preserved at most once on any path through the graph.
 *   This is the safe, expected case for most fields.
 * - `sometimes-multi`: Field can be preserved multiple times on some paths.
 *   This indicates potential issues with field preservation logic that may
 *   result in multiple values being accumulated in the stash.
 *
 * @example
 * ```typescript
 * // A field is 'sometimes-multi' if:
 * // Path 1: v1 -> v2 (preserves 'theme')
 * // Path 2: v2 -> v3 (preserves 'theme' again)
 * // Path 3: v1 -> v3 takes path v1 -> v2 -> v3, preserving 'theme' twice
 * ```
 */
export type FieldProfile = 'always-single' | 'sometimes-multi';

/**
 * Map of field names to their preservation profiles.
 * Tracks how each field behaves across all possible migration paths.
 */
export type FieldProfileMap = Record<string, FieldProfile>;

/**
 * Analysis of version connectivity in the migration graph.
 * Determines if all versions can reach each other through migration paths.
 */
export interface ConnectivityAnalysis {
  /**
   * Whether the graph is fully connected.
   * True if every version can reach every other version through migrations.
   */
  fullyConnected: boolean;
  /**
   * Connected components in the graph.
   * Each component is a group of versions that can reach each other.
   * A fully connected graph has exactly one component containing all versions.
   */
  components: readonly (readonly string[])[];
  /**
   * Sample pairs of versions that cannot reach each other.
   * Only present when fullyConnected is false.
   * Contains one representative pair from each disconnected component pair.
   */
  unreachablePairs?: readonly { from: string; to: string }[];
}

/**
 * A diagnostic message reporting an issue, warning, or informational note
 * discovered during graph analysis.
 */
export interface Diagnostic {
  /**
   * Source location where the issue was detected.
   * May be undefined for graph-level issues not tied to specific code.
   */
  location?: {
    /** File path where the issue occurs */
    file: string;
    /** Line number (1-indexed) */
    line: number;
    /** Column number (1-indexed) */
    column: number;
  };
  /**
   * Severity level of the diagnostic.
   *
   * - `error`: Must be fixed. Indicates a serious problem that will cause runtime issues.
   * - `warning`: Should be reviewed. Indicates potential problems or code smells.
   * - `info`: Informational only. Provides suggestions or context.
   */
  severity: 'error' | 'warning' | 'info';
  /** Machine-readable diagnostic code for categorizing issues */
  code: DiagnosticCode;
  /** Human-readable message describing the issue */
  message: string;
  /**
   * Additional context about the issue.
   * Structure varies by diagnostic code.
   */
  details?: {
    /** Field name involved in the issue */
    field?: string;
    /** Expected field profile type */
    expectedKind?: 'single';
    /** Actual field profile type detected */
    actualKind?: 'sometimes-multi';
    /** Migration paths that demonstrate the issue */
    problematicPaths?: readonly PathSummary[];
  };
  /** Suggested automated fixes for the issue */
  fixes?: readonly SuggestedFix[];
}

/**
 * Machine-readable diagnostic codes.
 *
 * - `FIELD_PROFILE_MISMATCH`: Field is preserved multiple times on some paths
 * - `UNCONSUMED_PRESERVATION`: Field was preserved but never consumed
 * - `STASH_CONFLICT_POSSIBLE`: Multiple migrations may conflict on field preservation
 * - `DISCONNECTED_VERSIONS`: Some versions cannot reach each other
 * - `DEPRECATED_VERSION_IN_PATH`: Migration path uses a deprecated version
 * - `LOSSY_PATH`: Migration path loses data (irreversible transformation)
 */
export type DiagnosticCode =
  | 'FIELD_PROFILE_MISMATCH'
  | 'UNCONSUMED_PRESERVATION'
  | 'STASH_CONFLICT_POSSIBLE'
  | 'DISCONNECTED_VERSIONS'
  | 'DEPRECATED_VERSION_IN_PATH'
  | 'LOSSY_PATH';

/**
 * Summary of a migration path between two versions.
 */
export interface PathSummary {
  /** Starting version */
  from: string;
  /** Ending version */
  to: string;
  /**
   * Number of migration steps in the path.
   * May be -1 to indicate that no path exists.
   */
  steps: number;
}

/**
 * Automated fix suggestion for a diagnostic issue.
 */
export interface SuggestedFix {
  /** Human-readable description of what the fix does */
  description: string;
  /** Text edits to apply to fix the issue */
  edits: readonly TextEdit[];
}

/**
 * A text edit operation to apply to a source file.
 */
export interface TextEdit {
  /** File path to edit */
  file: string;
  /** Range of text to replace */
  range: { start: Position; end: Position };
  /** New text to insert at the range */
  newText: string;
}

/**
 * Position in a source file.
 */
export interface Position {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
}

/**
 * Report of lossy migration paths in the graph.
 * A lossy path is one where data may be lost during migration
 * (either through one-way transformations or dropped fields).
 */
export interface LossyPathReport {
  /** Version pairs with lossy migration paths */
  lossyPairs: readonly {
    /** Starting version */
    from: string;
    /** Ending version */
    to: string;
    /** Detailed analysis of the lossy path */
    analysis: LossyPathAnalysis;
  }[];
  /** Total number of version pairs analyzed */
  totalVersionPairs: number;
  /** Number of version pairs with lossy paths */
  lossyPairCount: number;
  /** Number of version pairs with no path at all */
  unreachablePairCount: number;
}

/**
 * Detailed analysis of a potentially lossy migration path.
 */
export interface LossyPathAnalysis {
  /** Starting version */
  from: string;
  /** Ending version */
  to: string;
  /** Whether any path exists between the versions */
  pathExists: boolean;
  /**
   * Whether the path loses data.
   * True if any step in the path has lossy traits (irreversible transformations).
   */
  isLossy: boolean;
  /**
   * Individual migration steps that lose data.
   * Empty array if the path is lossless.
   */
  lossySteps: readonly {
    /** Starting version of the lossy step */
    from: string;
    /** Ending version of the lossy step */
    to: string;
    /** Direction of migration (up = forward, down = backward) */
    direction: 'up' | 'down';
    /** Description of what data is lost or why the migration is irreversible */
    reason: string;
  }[];
  /** The full migration path (if one exists) */
  path?: MigrationPath;
}

/**
 * Suggestion for a new migration that would improve the graph.
 */
export interface MigrationSuggestion {
  /** Starting version for the suggested migration */
  from: string;
  /** Ending version for the suggested migration */
  to: string;
  /**
   * Reason why this migration would be beneficial.
   *
   * - `eliminates_lossy_path`: Creates a lossless alternative to an existing lossy path
   * - `shortens_path`: Provides a more direct route between versions
   * - `bridges_components`: Connects disconnected version components
   */
  reason: 'eliminates_lossy_path' | 'shortens_path' | 'bridges_components';
  /**
   * Fields that are currently lost on the existing path.
   * Only present when reason is 'eliminates_lossy_path'.
   */
  currentLoss?: readonly string[];
  /**
   * Number of steps in the current path.
   * May be -1 if no path currently exists.
   */
  currentPathLength: number;
}

/**
 * Information about a deprecated version and where it's used.
 */
export interface DeprecatedVersionInfo {
  /** The deprecated version identifier */
  version: string;
  /** Deprecation metadata */
  deprecated: {
    /** Version when deprecation was announced */
    since: string;
    /** Deadline for migrating away from this version (optional) */
    deadline?: string;
    /** Recommended replacement version */
    successor: string;
    /** Additional context about why the version was deprecated (optional) */
    message?: string;
  };
  /** Migration paths that include this deprecated version */
  usedInPaths: readonly PathSummary[];
}

/**
 * Options for customizing graph analysis behavior.
 */
export interface AnalysisOptions {
  /**
   * Maximum path length to analyze.
   * Paths longer than this will be flagged as potentially needing direct migrations.
   * @default unlimited
   */
  maxPathLength?: number;
  /**
   * Limit analysis to a specific version range.
   * Useful for incremental analysis of recent changes.
   */
  versionRange?: {
    /** Start version (inclusive) */
    from?: string;
    /** End version (inclusive) */
    to?: string;
  };
  /**
   * Skip analysis of deprecated versions.
   * Set to true to focus analysis on current versions only.
   * @default false
   */
  skipDeprecated?: boolean;
}
