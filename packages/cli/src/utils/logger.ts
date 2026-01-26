/**
 * Simple logger utilities for CLI output.
 * Provides colored console output for different message types.
 *
 * @packageDocumentation
 */

/**
 * ANSI color codes for terminal output.
 */
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
} as const;

/**
 * Check if the output stream supports colors.
 * Respects NO_COLOR and FORCE_COLOR environment variables.
 */
function supportsColor(): boolean {
  if (process.env['NO_COLOR'] !== undefined) {
    return false;
  }
  if (process.env['FORCE_COLOR'] !== undefined) {
    return true;
  }
  // isTTY can be undefined in non-TTY environments
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return process.stdout.isTTY ?? false;
}

const useColor = supportsColor();

/**
 * Apply color to text if color is supported.
 */
function colorize(text: string, color: string): string {
  return useColor ? `${color}${text}${colors.reset}` : text;
}

/**
 * Logger for CLI output.
 * @public
 */
export const logger = {
  /**
   * Log an informational message.
   */
  info(message: string): void {
    console.log(colorize(message, colors.blue));
  },

  /**
   * Log a success message.
   */
  success(message: string): void {
    console.log(colorize(message, colors.green));
  },

  /**
   * Log a warning message.
   */
  warn(message: string): void {
    console.warn(colorize(`Warning: ${message}`, colors.yellow));
  },

  /**
   * Log an error message.
   */
  error(message: string): void {
    console.error(colorize(`Error: ${message}`, colors.red));
  },

  /**
   * Log a plain message without color.
   */
  log(message: string): void {
    console.log(message);
  },

  /**
   * Log a debug message (gray, dimmed).
   */
  debug(message: string): void {
    console.log(colorize(message, colors.gray));
  },

  /**
   * Log a bold message.
   */
  bold(message: string): void {
    console.log(colorize(message, colors.bold));
  },
};
