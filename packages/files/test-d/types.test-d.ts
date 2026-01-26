import { expectType, expectAssignable } from 'tsd';
import type { MigrationGraph, MigrationPath } from '@migrex/core';
import {
  loadConfig,
  saveConfig,
  watchConfig,
  diffVersions,
  ConfigFileError,
  type LoadConfigOptions,
  type LoadConfigResult,
  type SaveConfigOptions,
  type WatchConfigOptions,
  type ConfigWatcher,
  type VersionDiff,
} from '@migrex/files';

// Verify LoadConfigOptions interface
const loadOptions: LoadConfigOptions = {
  targetVersion: '2.0.0',
  format: 'json',
};
expectAssignable<LoadConfigOptions>(loadOptions);

// Verify optional format values
const loadOptionsWithYaml: LoadConfigOptions = {
  format: 'yaml',
};
expectAssignable<LoadConfigOptions>(loadOptionsWithYaml);

// Verify SaveConfigOptions interface
const saveOptions: SaveConfigOptions = {
  version: '1.0.0',
  format: 'json',
  pretty: true,
};
expectAssignable<SaveConfigOptions>(saveOptions);

// Verify WatchConfigOptions interface
const watchOptions: WatchConfigOptions = {
  targetVersion: '2.0.0',
  debounceMs: 100,
  onUpdate: (_config: LoadConfigResult<unknown>) => {},
  onError: (_error: Error) => {},
};
expectAssignable<WatchConfigOptions>(watchOptions);

// Verify LoadConfigResult structure
interface TestConfig {
  name: string;
  port: number;
}

const loadResult: LoadConfigResult<TestConfig> = {
  data: { name: 'test', port: 3000 },
  sourceVersion: '1.0.0',
  targetVersion: '2.0.0',
  wasUpgraded: true,
};
expectType<TestConfig>(loadResult.data);
expectType<string>(loadResult.sourceVersion);
expectType<string>(loadResult.targetVersion);
expectType<boolean>(loadResult.wasUpgraded);

// Verify optional migrationPath
const loadResultWithPath: LoadConfigResult<TestConfig> = {
  data: { name: 'test', port: 3000 },
  sourceVersion: '1.0.0',
  targetVersion: '2.0.0',
  migrationPath: {} as MigrationPath,
  wasUpgraded: true,
};
expectType<MigrationPath | undefined>(loadResultWithPath.migrationPath);

// Verify VersionDiff structure
const versionDiff: VersionDiff = {
  from: '1.0.0',
  to: '2.0.0',
  addedFields: ['newField'],
  removedFields: ['oldField'],
  modifiedFields: ['changedField'],
};
expectType<string>(versionDiff.from);
expectType<string>(versionDiff.to);
expectType<string[]>(versionDiff.addedFields);
expectType<string[]>(versionDiff.removedFields);
expectType<string[]>(versionDiff.modifiedFields);

// Verify ConfigFileError is a proper Error subclass
const configError = new ConfigFileError('test message', '/path/to/file');
expectAssignable<Error>(configError);
expectType<string>(configError.filePath);
expectType<string>(configError.message);

// Verify ConfigWatcher interface
const watcher: ConfigWatcher = {
  stop: () => {},
};
expectType<ConfigWatcher>(watcher);

// Verify function return types with mock graph
declare const mockGraph: MigrationGraph;

// loadConfig returns Promise<LoadConfigResult<T>>
const loadPromise = loadConfig<TestConfig>(mockGraph, './config.json');
expectType<Promise<LoadConfigResult<TestConfig>>>(loadPromise);

// saveConfig returns Promise<void>
const savePromise = saveConfig(mockGraph, './config.json', { name: 'test' });
expectType<Promise<void>>(savePromise);

// watchConfig returns ConfigWatcher
const watchHandle = watchConfig(mockGraph, './config.json');
expectType<ConfigWatcher>(watchHandle);

// diffVersions returns VersionDiff
const diff = diffVersions(mockGraph, '1.0.0', '2.0.0');
expectType<VersionDiff>(diff);
