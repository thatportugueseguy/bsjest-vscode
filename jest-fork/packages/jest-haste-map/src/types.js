/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {InternalHasteMap, ModuleMetaData} from 'types/HasteMap';

export type IgnoreMatcher = (item: string) => boolean;

export type WorkerMessage = {
  computeSha1: boolean,
  filePath: string,
  hasteImplModulePath?: string,
};

export type WorkerMetadata = {|
  dependencies: ?Array<string>,
  id: ?string,
  module: ?ModuleMetaData,
  sha1: ?string,
|};

export type CrawlerOptions = {|
  computeSha1: boolean,
  data: InternalHasteMap,
  extensions: Array<string>,
  forceNodeFilesystemAPI: boolean,
  ignore: IgnoreMatcher,
  roots: Array<string>,
|};

export type HasteImpl = {
  getHasteName(filePath: string): string | void,
};
