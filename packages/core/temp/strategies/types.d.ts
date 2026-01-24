/**
 * Version strategy interface for comparing and validating version strings.
 * Different strategies (semver, calver, integer) implement this interface.
 */
export interface VersionStrategy {
    /** Unique identifier for this strategy */
    readonly id: string;
    /**
     * Compare two version strings.
     * @returns -1 if a < b, 0 if a === b, 1 if a > b
     */
    compare(a: string, b: string): -1 | 0 | 1;
    /**
     * Check if a version string is valid according to this strategy.
     */
    isValid(version: string): boolean;
    /**
     * Normalize a version string to canonical form (optional).
     * For example, semver might normalize "1.0" to "1.0.0".
     */
    normalize?(version: string): string;
    /**
     * Parse a version string into components (optional).
     */
    parse?(version: string): VersionComponents;
    /**
     * Increment a version according to increment type (optional).
     */
    increment?(version: string, type: IncrementType): string;
}
/**
 * Parsed components of a version string.
 */
export interface VersionComponents {
    /** Main version parts (e.g., [1, 2, 3] for "1.2.3") */
    parts: (string | number)[];
    /** Prerelease identifier (e.g., "alpha.1" in "1.0.0-alpha.1") */
    prerelease?: string;
    /** Build metadata (e.g., "20130313144700" in "1.0.0+20130313144700") */
    build?: string;
}
/**
 * Type of version increment to perform.
 */
export type IncrementType = 'major' | 'minor' | 'patch' | 'prerelease';
//# sourceMappingURL=types.d.ts.map