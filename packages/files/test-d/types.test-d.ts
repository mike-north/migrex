import { expectType, expectAssignable } from 'tsd';
import type { MigrationGraph, MigrationPath } from '@migrex/core';
import {
  loadVersionedFile,
  saveVersionedFile,
  watchVersionedFile,
  diffVersions,
  VersionedFileError,
  type LoadOptions,
  type LoadResult,
  type SaveOptions,
  type WatchOptions,
  type FileWatcher,
  type VersionDiff,
} from '@migrex/files';

// Verify LoadOptions interface
const loadOptions: LoadOptions = {
  targetVersion: '2.0.0',
  format: 'json',
};
expectAssignable<LoadOptions>(loadOptions);

// Verify optional format values
const loadOptionsWithYaml: LoadOptions = {
  format: 'yaml',
};
expectAssignable<LoadOptions>(loadOptionsWithYaml);

// Verify TOML format support
const loadOptionsWithToml: LoadOptions = {
  format: 'toml',
};
expectAssignable<LoadOptions>(loadOptionsWithToml);

// Verify SaveOptions interface
const saveOptions: SaveOptions = {
  version: '1.0.0',
  format: 'json',
  pretty: true,
};
expectAssignable<SaveOptions>(saveOptions);

// Verify SaveOptions with TOML format
const saveOptionsToml: SaveOptions = {
  format: 'toml',
};
expectAssignable<SaveOptions>(saveOptionsToml);

// Verify WatchOptions interface
const watchOptions: WatchOptions = {
  targetVersion: '2.0.0',
  debounceMs: 100,
  onUpdate: (_result: LoadResult<unknown>) => {},
  onError: (_error: Error) => {},
};
expectAssignable<WatchOptions>(watchOptions);

// Verify LoadResult structure
interface TestConfig {
  name: string;
  port: number;
}

const loadResult: LoadResult<TestConfig> = {
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
const loadResultWithPath: LoadResult<TestConfig> = {
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

// Verify VersionedFileError is a proper Error subclass
const fileError = new VersionedFileError('test message', '/path/to/file');
expectAssignable<Error>(fileError);
expectType<string>(fileError.filePath);
expectType<string>(fileError.message);

// Verify FileWatcher interface
const watcher: FileWatcher = {
  stop: () => {},
};
expectType<FileWatcher>(watcher);

// Verify function return types with mock graph
declare const mockGraph: MigrationGraph;

// loadVersionedFile returns Promise<LoadResult<T>>
const loadPromise = loadVersionedFile<TestConfig>(mockGraph, './config.json');
expectType<Promise<LoadResult<TestConfig>>>(loadPromise);

// saveVersionedFile returns Promise<void>
const savePromise = saveVersionedFile(mockGraph, './config.json', { name: 'test' });
expectType<Promise<void>>(savePromise);

// watchVersionedFile returns FileWatcher
const watchHandle = watchVersionedFile(mockGraph, './config.json');
expectType<FileWatcher>(watchHandle);

// diffVersions returns VersionDiff
const diff = diffVersions(mockGraph, '1.0.0', '2.0.0');
expectType<VersionDiff>(diff);
