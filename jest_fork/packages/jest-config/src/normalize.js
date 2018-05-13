/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Argv} from 'types/Argv';
import type {InitialOptions, ReporterConfig} from 'types/Config';

import crypto from 'crypto';
import glob from 'glob';
import path from 'path';
import {ValidationError, validate} from 'jest-validate';
import validatePattern from './validate_pattern';
import {clearLine} from 'jest-util';
import chalk from 'chalk';
import getMaxWorkers from './get_max_workers';
import Resolver from 'jest-resolve';
import {replacePathSepForRegex} from 'jest-regex-util';
import {
  BULLET,
  DOCUMENTATION_NOTE,
  replaceRootDirInPath,
  _replaceRootDirTags,
  escapeGlobCharacters,
  getTestEnvironment,
  resolve,
} from './utils';
import {DEFAULT_JS_PATTERN, DEFAULT_REPORTER_LABEL} from './constants';
import {validateReporters} from './reporter_validation_errors';
import DEFAULT_CONFIG from './defaults';
import DEPRECATED_CONFIG from './deprecated';
import setFromArgv from './set_from_argv';
import VALID_CONFIG from './valid_config';
const ERROR = `${BULLET}Validation Error`;
const JSON_EXTENSION = '.json';
const PRESET_NAME = 'jest-preset' + JSON_EXTENSION;

const createConfigError = message =>
  new ValidationError(ERROR, message, DOCUMENTATION_NOTE);

const mergeOptionWithPreset = (
  options: InitialOptions,
  preset: InitialOptions,
  optionName: string,
) => {
  if (options[optionName] && preset[optionName]) {
    options[optionName] = Object.assign(
      {},
      options[optionName],
      preset[optionName],
      options[optionName],
    );
  }
};

const setupPreset = (
  options: InitialOptions,
  optionsPreset: string,
): InitialOptions => {
  let preset;
  const presetPath = replaceRootDirInPath(options.rootDir, optionsPreset);
  const presetModule = Resolver.findNodeModule(
    presetPath.endsWith(JSON_EXTENSION)
      ? presetPath
      : path.join(presetPath, PRESET_NAME),
    {
      basedir: options.rootDir,
    },
  );

  try {
    // $FlowFixMe
    preset = (require(presetModule): InitialOptions);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw createConfigError(
        `  Preset ${chalk.bold(presetPath)} is invalid:\n  ${error.message}`,
      );
    }
    throw createConfigError(`  Preset ${chalk.bold(presetPath)} not found.`);
  }

  if (options.setupFiles) {
    options.setupFiles = (preset.setupFiles || []).concat(options.setupFiles);
  }
  if (options.modulePathIgnorePatterns && preset.modulePathIgnorePatterns) {
    options.modulePathIgnorePatterns = preset.modulePathIgnorePatterns.concat(
      options.modulePathIgnorePatterns,
    );
  }
  mergeOptionWithPreset(options, preset, 'moduleNameMapper');
  mergeOptionWithPreset(options, preset, 'transform');

  return Object.assign({}, preset, options);
};

const setupBabelJest = (options: InitialOptions) => {
  const transform = options.transform;
  let babelJest;
  if (transform) {
    const customJSPattern = Object.keys(transform).find(pattern => {
      const regex = new RegExp(pattern);
      return regex.test('a.js') || regex.test('a.jsx');
    });

    if (customJSPattern) {
      const customJSTransformer = transform[customJSPattern];

      if (customJSTransformer === 'babel-jest') {
        babelJest = require.resolve('babel-jest');
        transform[customJSPattern] = babelJest;
      } else if (customJSTransformer.includes('babel-jest')) {
        babelJest = customJSTransformer;
      }
    }
  } else {
    babelJest = require.resolve('babel-jest');
    options.transform = {
      [DEFAULT_JS_PATTERN]: babelJest,
    };
  }

  return babelJest;
};

const normalizeCollectCoverageOnlyFrom = (
  options: InitialOptions,
  key: string,
) => {
  const collectCoverageOnlyFrom = Array.isArray(options[key])
    ? options[key] // passed from argv
    : Object.keys(options[key]); // passed from options
  return collectCoverageOnlyFrom.reduce((map, filePath) => {
    filePath = path.resolve(
      options.rootDir,
      replaceRootDirInPath(options.rootDir, filePath),
    );
    map[filePath] = true;
    return map;
  }, Object.create(null));
};

const normalizeCollectCoverageFrom = (options: InitialOptions, key: string) => {
  let value;
  if (!options[key]) {
    value = [];
  }

  if (!Array.isArray(options[key])) {
    try {
      value = JSON.parse(options[key]);
    } catch (e) {}

    Array.isArray(value) || (value = [options[key]]);
  } else {
    value = options[key];
  }

  if (value) {
    value = value.map(filePath => {
      return filePath.replace(/^(!?)(<rootDir>\/)(.*)/, '$1$3');
    });
  }

  return value;
};

const normalizeUnmockedModulePathPatterns = (
  options: InitialOptions,
  key: string,
) => {
  // _replaceRootDirTags is specifically well-suited for substituting
  // <rootDir> in paths (it deals with properly interpreting relative path
  // separators, etc).
  //
  // For patterns, direct global substitution is far more ideal, so we
  // special case substitutions for patterns here.
  return options[key].map(pattern =>
    replacePathSepForRegex(pattern.replace(/<rootDir>/g, options.rootDir)),
  );
};

const normalizePreprocessor = (options: InitialOptions): InitialOptions => {
  if (options.scriptPreprocessor && options.transform) {
    throw createConfigError(
      `  Options: ${chalk.bold('scriptPreprocessor')} and ${chalk.bold(
        'transform',
      )} cannot be used together.
  Please change your configuration to only use ${chalk.bold('transform')}.`,
    );
  }

  if (options.preprocessorIgnorePatterns && options.transformIgnorePatterns) {
    throw createConfigError(
      `  Options ${chalk.bold('preprocessorIgnorePatterns')} and ${chalk.bold(
        'transformIgnorePatterns',
      )} cannot be used together.
  Please change your configuration to only use ${chalk.bold(
    'transformIgnorePatterns',
  )}.`,
    );
  }

  if (options.scriptPreprocessor) {
    options.transform = {
      '.*': options.scriptPreprocessor,
    };
  }

  if (options.preprocessorIgnorePatterns) {
    options.transformIgnorePatterns = options.preprocessorIgnorePatterns;
  }

  delete options.scriptPreprocessor;
  delete options.preprocessorIgnorePatterns;
  return options;
};

const normalizeMissingOptions = (options: InitialOptions): InitialOptions => {
  if (!options.name) {
    options.name = crypto
      .createHash('md5')
      .update(options.rootDir)
      .digest('hex');
  }

  if (!options.setupFiles) {
    options.setupFiles = [];
  }

  return options;
};

const normalizeRootDir = (options: InitialOptions): InitialOptions => {
  // Assert that there *is* a rootDir
  if (!options.hasOwnProperty('rootDir')) {
    throw createConfigError(
      `  Configuration option ${chalk.bold('rootDir')} must be specified.`,
    );
  }
  options.rootDir = path.normalize(options.rootDir);
  return options;
};

const normalizeReporters = (options: InitialOptions, basedir) => {
  const reporters = options.reporters;
  if (!reporters || !Array.isArray(reporters)) {
    return options;
  }

  validateReporters(reporters);
  options.reporters = reporters.map(reporterConfig => {
    const normalizedReporterConfig: ReporterConfig =
      typeof reporterConfig === 'string'
        ? // if reporter config is a string, we wrap it in an array
          // and pass an empty object for options argument, to normalize
          // the shape.
          [reporterConfig, {}]
        : reporterConfig;

    const reporterPath = replaceRootDirInPath(
      options.rootDir,
      normalizedReporterConfig[0],
    );

    if (reporterPath !== DEFAULT_REPORTER_LABEL) {
      const reporter = Resolver.findNodeModule(reporterPath, {
        basedir: options.rootDir,
      });
      if (!reporter) {
        throw new Error(
          `Could not resolve a module for a custom reporter.\n` +
            `  Module name: ${reporterPath}`,
        );
      }
      normalizedReporterConfig[0] = reporter;
    }
    return normalizedReporterConfig;
  });

  return options;
};

const buildTestPathPattern = (argv: Argv): string => {
  const patterns = [];

  if (argv._) {
    patterns.push(...argv._);
  }
  if (argv.testPathPattern) {
    patterns.push(...argv.testPathPattern);
  }

  const replacePosixSep = (pattern: string) => {
    if (path.sep === '/') {
      return pattern;
    }
    return pattern.replace(/\//g, '\\\\');
  };

  const testPathPattern = patterns.map(replacePosixSep).join('|');
  if (validatePattern(testPathPattern)) {
    return testPathPattern;
  } else {
    showTestPathPatternError(testPathPattern);
    return '';
  }
};

const showTestPathPatternError = (testPathPattern: string) => {
  clearLine(process.stdout);

  console.log(
    chalk.red(
      `  Invalid testPattern ${testPathPattern} supplied. ` +
        `Running all tests instead.`,
    ),
  );
};

export default function normalize(options: InitialOptions, argv: Argv) {
  const {hasDeprecationWarnings} = validate(options, {
    comment: DOCUMENTATION_NOTE,
    deprecatedConfig: DEPRECATED_CONFIG,
    exampleConfig: VALID_CONFIG,
  });

  options = normalizePreprocessor(
    normalizeReporters(
      normalizeMissingOptions(normalizeRootDir(setFromArgv(options, argv))),
    ),
  );

  if (options.preset) {
    options = setupPreset(options, options.preset);
  }

  if (options.testEnvironment) {
    options.testEnvironment = getTestEnvironment(options);
  }

  if (!options.roots && options.testPathDirs) {
    options.roots = options.testPathDirs;
    delete options.testPathDirs;
  }
  if (!options.roots) {
    options.roots = [options.rootDir];
  }

  if (!options.testRunner || options.testRunner === 'jasmine2') {
    options.testRunner = require.resolve('jest-jasmine2');
  }

  if (!options.coverageDirectory) {
    options.coverageDirectory = path.resolve(options.rootDir, 'coverage');
  }

  const babelJest = setupBabelJest(options);
  const newOptions = Object.assign({}, DEFAULT_CONFIG);
  // Cast back to exact type
  options = (options: InitialOptions);

  if (options.resolver) {
    newOptions.resolver = resolve(
      null,
      options.rootDir,
      'resolver',
      options.resolver,
    );
  }

  Object.keys(options).reduce((newOptions, key) => {
    // The resolver has been resolved separately; skip it
    if (key === 'resolver') {
      return newOptions;
    }
    let value;
    switch (key) {
      case 'collectCoverageOnlyFrom':
        value = normalizeCollectCoverageOnlyFrom(options, key);
        break;
      case 'setupFiles':
      case 'snapshotSerializers':
        value =
          options[key] &&
          options[key].map(
            resolve.bind(null, newOptions.resolver, options.rootDir, key),
          );
        break;
      case 'modulePaths':
      case 'roots':
        value =
          options[key] &&
          options[key].map(filePath =>
            path.resolve(
              options.rootDir,
              replaceRootDirInPath(options.rootDir, filePath),
            ),
          );
        break;
      case 'collectCoverageFrom':
        value = normalizeCollectCoverageFrom(options, key);
        break;
      case 'cacheDirectory':
      case 'coverageDirectory':
        value =
          options[key] &&
          path.resolve(
            options.rootDir,
            replaceRootDirInPath(options.rootDir, options[key]),
          );
        break;
      case 'globalSetup':
      case 'globalTeardown':
      case 'moduleLoader':
      case 'runner':
      case 'setupTestFrameworkScriptFile':
      case 'testResultsProcessor':
      case 'testRunner':
        value =
          options[key] &&
          resolve(newOptions.resolver, options.rootDir, key, options[key]);
        break;
      case 'moduleNameMapper':
        const moduleNameMapper = options[key];
        value =
          moduleNameMapper &&
          Object.keys(moduleNameMapper).map(regex => {
            const item = moduleNameMapper && moduleNameMapper[regex];
            return item && [regex, _replaceRootDirTags(options.rootDir, item)];
          });
        break;
      case 'transform':
        const transform = options[key];
        value =
          transform &&
          Object.keys(transform).map(regex => [
            regex,
            resolve(
              newOptions.resolver,
              options.rootDir,
              key,
              transform[regex],
            ),
          ]);
        break;
      case 'coveragePathIgnorePatterns':
      case 'modulePathIgnorePatterns':
      case 'testPathIgnorePatterns':
      case 'transformIgnorePatterns':
      case 'watchPathIgnorePatterns':
      case 'unmockedModulePathPatterns':
        value = normalizeUnmockedModulePathPatterns(options, key);
        break;
      case 'haste':
        value = Object.assign({}, options[key]);
        if (value.hasteImplModulePath != null) {
          value.hasteImplModulePath = resolve(
            newOptions.resolver,
            options.rootDir,
            'haste.hasteImplModulePath',
            replaceRootDirInPath(options.rootDir, value.hasteImplModulePath),
          );
        }
        break;
      case 'projects':
        value = (options[key] || [])
          .map(
            project =>
              typeof project === 'string'
                ? _replaceRootDirTags(options.rootDir, project)
                : project,
          )
          .reduce((projects, project) => {
            // Project can be specified as globs. If a glob matches any files,
            // We expand it to these paths. If not, we keep the original path
            // for the future resolution.
            const globMatches =
              typeof project === 'string' ? glob.sync(project) : [];
            return projects.concat(globMatches.length ? globMatches : project);
          }, []);
        break;
      case 'moduleDirectories':
      case 'testMatch':
        value = _replaceRootDirTags(
          escapeGlobCharacters(options.rootDir),
          options[key],
        );
        break;
      case 'testRegex':
        value = options[key] && replacePathSepForRegex(options[key]);
        break;
      case 'filter':
        value =
          options[key] &&
          resolve(newOptions.resolver, options.rootDir, key, options[key]);
        break;
      case 'automock':
      case 'bail':
      case 'browser':
      case 'cache':
      case 'changedSince':
      case 'changedFilesWithAncestor':
      case 'clearMocks':
      case 'collectCoverage':
      case 'coverageReporters':
      case 'coverageThreshold':
      case 'detectLeaks':
      case 'detectOpenHandles':
      case 'displayName':
      case 'expand':
      case 'globals':
      case 'findRelatedTests':
      case 'forceCoverageMatch':
      case 'forceExit':
      case 'lastCommit':
      case 'listTests':
      case 'logHeapUsage':
      case 'mapCoverage':
      case 'moduleFileExtensions':
      case 'name':
      case 'noStackTrace':
      case 'notify':
      case 'notifyMode':
      case 'onlyChanged':
      case 'outputFile':
      case 'passWithNoTests':
      case 'replname':
      case 'reporters':
      case 'resetMocks':
      case 'resetModules':
      case 'restoreMocks':
      case 'rootDir':
      case 'runTestsByPath':
      case 'silent':
      case 'skipFilter':
      case 'skipNodeResolution':
      case 'testEnvironment':
      case 'testEnvironmentOptions':
      case 'testFailureExitCode':
      case 'testLocationInResults':
      case 'testNamePattern':
      case 'testURL':
      case 'timers':
      case 'useStderr':
      case 'verbose':
      case 'watch':
      case 'watchAll':
      case 'watchman':
        value = options[key];
        break;
      case 'watchPlugins':
        value = (options[key] || []).map(watchPlugin =>
          resolve(newOptions.resolver, options.rootDir, key, watchPlugin),
        );
        break;
    }
    newOptions[key] = value;
    return newOptions;
  }, newOptions);

  newOptions.nonFlagArgs = argv._;
  newOptions.testPathPattern = buildTestPathPattern(argv);
  newOptions.json = argv.json;

  newOptions.testFailureExitCode = parseInt(newOptions.testFailureExitCode, 10);

  for (const key of [
    'lastCommit',
    'changedFilesWithAncestor',
    'changedSince',
  ]) {
    if (newOptions[key]) {
      newOptions.onlyChanged = true;
    }
  }

  if (argv.all) {
    newOptions.onlyChanged = false;
  } else if (newOptions.testPathPattern) {
    // When passing a test path pattern we don't want to only monitor changed
    // files unless `--watch` is also passed.
    newOptions.onlyChanged = newOptions.watch;
  }

  newOptions.updateSnapshot =
    argv.ci && !argv.updateSnapshot
      ? 'none'
      : argv.updateSnapshot
        ? 'all'
        : 'new';

  newOptions.maxWorkers = getMaxWorkers(argv);

  if (babelJest) {
    const regeneratorRuntimePath = Resolver.findNodeModule(
      'regenerator-runtime/runtime',
      {basedir: options.rootDir, resolver: newOptions.resolver},
    );

    if (regeneratorRuntimePath) {
      newOptions.setupFiles.unshift(regeneratorRuntimePath);
    }
  }

  if (options.testRegex && options.testMatch) {
    throw createConfigError(
      `  Configuration options ${chalk.bold('testMatch')} and` +
        ` ${chalk.bold('testRegex')} cannot be used together.`,
    );
  }

  if (options.testRegex && !options.testMatch) {
    // Prevent the default testMatch conflicting with any explicitly
    // configured `testRegex` value
    newOptions.testMatch = [];
  }

  // If argv.json is set, coverageReporters shouldn't print a text report.
  if (argv.json) {
    newOptions.coverageReporters = (newOptions.coverageReporters || []).filter(
      reporter => reporter !== 'text',
    );
  }

  // If collectCoverage is enabled while using --findRelatedTests we need to
  // avoid having false negatives in the generated coverage report.
  // The following: `--findRelatedTests '/rootDir/file1.js' --coverage`
  // Is transformed to: `--findRelatedTests '/rootDir/file1.js' --coverage --collectCoverageFrom 'file1.js'`
  // where arguments to `--collectCoverageFrom` should be globs (or relative
  // paths to the rootDir)
  if (newOptions.collectCoverage && argv.findRelatedTests) {
    newOptions.collectCoverageFrom = argv._.map(filename => {
      filename = replaceRootDirInPath(options.rootDir, filename);
      return path.isAbsolute(filename)
        ? path.relative(options.rootDir, filename)
        : filename;
    });
  }

  return {
    hasDeprecationWarnings,
    options: newOptions,
  };
}
