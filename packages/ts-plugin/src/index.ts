/**
 * \@migrex/ts-plugin - TypeScript Language Service Plugin for migrex
 *
 * This plugin provides IDE integration for migrex, including:
 * - Diagnostics for consume() calls
 * - Quick fixes for migration issues
 * - Hover information for field profiles
 *
 * @packageDocumentation
 */

// TypeScript Language Service Plugin entry point

interface PluginCreateInfo {
  project: unknown;
  languageService: unknown;
  languageServiceHost: unknown;
  serverHost: unknown;
  config: PluginConfig;
}

interface PluginConfig {
  graphPath?: string;
}

/**
 * TypeScript Language Service Plugin factory.
 */
function init(_modules: { typescript: unknown }) {
  function create(info: PluginCreateInfo) {
    // TODO: Implement language service proxy
    const _config = info.config;

    return info.languageService;
  }

  function getExternalFiles(_project: unknown): string[] {
    return [];
  }

  return { create, getExternalFiles };
}

export = init;
