/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import prettyFormat from 'pretty-format';

function messageFormatter({error, message, passed}) {
  if (passed) {
    return 'Passed.';
  }
  if (message) {
    return message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (
    // duck-type Error, see #2549
    error &&
    typeof error === 'object' &&
    typeof error.message === 'string' &&
    typeof error.name === 'string'
  ) {
    return `${error.name}: ${error.message}`;
  }
  return `thrown: ${prettyFormat(error, {maxDepth: 3})}`;
}

function stackFormatter(options, initError, errorMessage) {
  if (options.passed) {
    return '';
  }

  if (options.error && options.error.stack) {
    return options.error.stack;
  }

  if (initError) {
    return errorMessage + '\n' + initError.stack;
  }

  return new Error(errorMessage).stack;
}

type Options = {
  matcherName: string,
  passed: boolean,
  actual?: any,
  error?: any,
  expected?: any,
  message?: string,
};

export default function expectationResultFactory(
  options: Options,
  initError?: Error,
) {
  const message = messageFormatter(options);
  const stack = stackFormatter(options, initError, message);

  if (options.passed) {
    return {
      error: options.error,
      matcherName: options.matcherName,
      message,
      passed: options.passed,
      stack,
    };
  }

  return {
    actual: options.actual,
    error: options.error,
    expected: options.expected,
    matcherName: options.matcherName,
    message,
    passed: options.passed,
    stack,
  };
}
