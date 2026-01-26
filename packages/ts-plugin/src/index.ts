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

import type * as ts from 'typescript';
import { createProxiedLanguageService } from './plugin.js';

/**
 * TypeScript Language Service Plugin factory.
 * This is the entry point called by TypeScript when loading the plugin.
 *
 * @param modules - TypeScript module loader
 * @returns Plugin module with create and getExternalFiles functions
 */
function init(modules: { typescript: typeof ts }): ts.server.PluginModule {
  const typescript = modules.typescript;

  return {
    /**
     * Create a proxied language service that adds migrex functionality.
     *
     * @param info - Plugin create info from TypeScript
     * @returns Proxied language service
     */
    create(info: ts.server.PluginCreateInfo): ts.LanguageService {
      // Log plugin creation
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      info.project.projectService?.logger?.info(
        '[migrex] Creating language service plugin'
      );

      // Create and return proxied language service
      return createProxiedLanguageService(info, typescript);
    },

    /**
     * Return external files to include in the project.
     * Migrex doesn't need to add external files.
     *
     * @returns Empty array
     */
    getExternalFiles(): string[] {
      return [];
    },
  };
}

export = init;
