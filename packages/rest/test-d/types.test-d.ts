import { expectType, expectAssignable } from 'tsd';
import type { MigrationGraph } from '@migrex/core';
import {
  createVersionedMiddleware,
  createVersionedEndpoint,
  extractVersionFromHeader,
  extractVersionFromPath,
  extractVersionFromQuery,
  type Request,
  type Response,
  type VersionExtractor,
  type VersionedMiddlewareOptions,
  type VersionedEndpointOptions,
  type NextFunction,
  type MiddlewareFunction,
} from '@migrex/rest';

// Verify Request interface
const request: Request = {
  headers: { 'X-API-Version': '1.0.0' },
  url: '/api/users',
};
expectType<Request>(request);

// Verify Response interface
const response: Response = {
  setHeader: (_name: string, _value: string) => {},
  json: (_data: unknown) => {},
};
expectType<Response>(response);

// Verify version extractors return VersionExtractor type
expectType<VersionExtractor>(extractVersionFromHeader('X-API-Version'));
expectType<VersionExtractor>(extractVersionFromPath(/\/api\/v([^\/]+)/));
expectType<VersionExtractor>(extractVersionFromQuery('version'));

// Verify version extractors return string | undefined when called
const headerExtractor = extractVersionFromHeader('X-API-Version');
expectType<string | undefined>(headerExtractor(request));

// Verify middleware options interface
const middlewareOptions: VersionedMiddlewareOptions = {
  extractVersion: headerExtractor,
  defaultVersion: '1.0.0',
  targetVersion: '2.0.0',
  warnOnLossy: true,
  deprecationHeader: 'Deprecation',
};
expectAssignable<VersionedMiddlewareOptions>(middlewareOptions);

// Verify endpoint options interface
const endpointOptions: VersionedEndpointOptions = {
  extractVersion: headerExtractor,
  defaultVersion: '1.0.0',
  warnOnLossy: false,
  deprecationHeader: 'Deprecation',
};
expectAssignable<VersionedEndpointOptions>(endpointOptions);

// Verify NextFunction type
const nextFn: NextFunction = (_error?: unknown) => {};
expectType<NextFunction>(nextFn);

// Verify createVersionedMiddleware returns MiddlewareFunction
declare const mockGraph: MigrationGraph;
const middleware = createVersionedMiddleware(mockGraph, middlewareOptions);
expectType<MiddlewareFunction>(middleware);

// Verify createVersionedEndpoint returns object with expected methods
const endpoint = createVersionedEndpoint(mockGraph, endpointOptions);
expectType<string>(endpoint.getRequestedVersion(request));
