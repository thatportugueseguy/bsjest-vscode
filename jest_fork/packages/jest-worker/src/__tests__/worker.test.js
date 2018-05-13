/**
 * Copyright (c) 2017-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

/* eslint-disable no-new */

import EventEmitter from 'events';

import {
  CHILD_MESSAGE_CALL,
  CHILD_MESSAGE_INITIALIZE,
  PARENT_MESSAGE_ERROR,
  PARENT_MESSAGE_OK,
} from '../types';

let Worker;
let forkInterface;
let childProcess;
let originalExecArgv;

beforeEach(() => {
  jest.mock('child_process');
  originalExecArgv = process.execArgv;

  childProcess = require('child_process');
  childProcess.fork.mockImplementation(() => {
    forkInterface = Object.assign(new EventEmitter(), {
      send: jest.fn(),
      stderr: {},
      stdout: {},
    });

    return forkInterface;
  });

  Worker = require('../worker').default;
});

afterEach(() => {
  jest.resetModules();
  process.execArgv = originalExecArgv;
});

it('passes fork options down to child_process.fork, adding the defaults', () => {
  const child = require.resolve('../child');

  process.execArgv = ['--inspect', '-p'];

  new Worker({
    forkOptions: {
      cwd: '/tmp',
      execPath: 'hello',
    },
    maxRetries: 3,
    workerId: process.env.JEST_WORKER_ID,
    workerPath: '/tmp/foo/bar/baz.js',
  });

  expect(childProcess.fork.mock.calls[0][0]).toBe(child);
  expect(childProcess.fork.mock.calls[0][1]).toEqual({
    cwd: '/tmp', // Overridden default option.
    env: process.env, // Default option.
    execArgv: ['-p'], // Filtered option.
    execPath: 'hello', // Added option.
    silent: true, // Default option.
  });
});

it('passes workerId to the child process and assign it to env.JEST_WORKER_ID', () => {
  new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerId: 2,
    workerPath: '/tmp/foo',
  });

  expect(childProcess.fork.mock.calls[0][1].env.JEST_WORKER_ID).toEqual(2);
});

it('initializes the child process with the given workerPath', () => {
  new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo/bar/baz.js',
  });

  expect(forkInterface.send.mock.calls[0][0]).toEqual([
    CHILD_MESSAGE_INITIALIZE,
    false,
    '/tmp/foo/bar/baz.js',
  ]);
});

it('stops initializing the worker after the amount of retries is exceeded', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo/bar/baz.js',
  });

  const request = [CHILD_MESSAGE_CALL, false, 'foo', []];
  const onProcessStart = jest.fn();
  const onProcessEnd = jest.fn();

  worker.send(request, onProcessStart, onProcessEnd);

  // We fail four times (initial + three retries).
  forkInterface.emit('exit');
  forkInterface.emit('exit');
  forkInterface.emit('exit');
  forkInterface.emit('exit');

  expect(childProcess.fork).toHaveBeenCalledTimes(5);
  expect(onProcessStart).toBeCalledWith(worker);
  expect(onProcessEnd.mock.calls[0][0]).toBeInstanceOf(Error);
  expect(onProcessEnd.mock.calls[0][0].type).toBe('WorkerError');
  expect(onProcessEnd.mock.calls[0][1]).toBe(null);
});

it('provides stdout and stderr fields from the child process', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  expect(worker.getStdout()).toBe(forkInterface.stdout);
  expect(worker.getStderr()).toBe(forkInterface.stderr);
});

it('swtiches the processed flag of a task as soon as it is processed', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const request1 = [CHILD_MESSAGE_CALL, false, 'foo', []];
  const request2 = [CHILD_MESSAGE_CALL, false, 'bar', []];

  worker.send(request1, () => {}, () => {});
  worker.send(request2, () => {}, () => {});

  // The queue is empty when it got send, so the task is processed.
  expect(request1[1]).toBe(true);

  // The previous one is being processed, so that one stays as unprocessed.
  expect(request2[1]).toBe(false);
});

it('sends the task to the child process', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const request = [CHILD_MESSAGE_CALL, false, 'foo', []];

  worker.send(request, () => {}, () => {});

  // Skipping call "0" because it corresponds to the "initialize" one.
  expect(forkInterface.send.mock.calls[1][0]).toEqual(request);
});

it('relates replies to requests, in order', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const onProcessStart1 = jest.fn();
  const onProcessEnd1 = jest.fn();
  const request1 = [CHILD_MESSAGE_CALL, false, 'foo', []];

  const onProcessStart2 = jest.fn();
  const onProcessEnd2 = jest.fn();
  const request2 = [CHILD_MESSAGE_CALL, false, 'bar', []];

  worker.send(request1, onProcessStart1, onProcessEnd1);
  worker.send(request2, onProcessStart2, onProcessEnd2);

  // 2nd call waits on the queue...
  expect(request2[1]).toBe(false);

  // then first call replies...
  forkInterface.emit('message', [PARENT_MESSAGE_OK, 44]);

  expect(onProcessStart1.mock.calls[0][0]).toBe(worker);
  expect(onProcessEnd1.mock.calls[0][0]).toBeFalsy();
  expect(onProcessEnd1.mock.calls[0][1]).toBe(44);

  // which causes the second call to be processed...
  expect(request2[1]).toBe(true);

  // and then the second call replies...
  forkInterface.emit('message', [
    PARENT_MESSAGE_ERROR,
    'TypeError',
    'foo',
    'TypeError: foo',
    {},
  ]);

  expect(onProcessStart2.mock.calls[0][0]).toBe(worker);
  expect(onProcessEnd2.mock.calls[0][0].message).toBe('foo');
});

it('calls the onProcessStart method synchronously if the queue is empty', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const onProcessStart = jest.fn();
  const onProcessEnd = jest.fn();

  worker.send(
    [CHILD_MESSAGE_CALL, false, 'foo', []],
    onProcessStart,
    onProcessEnd,
  );

  // Only onProcessStart has been called
  expect(onProcessStart).toHaveBeenCalledTimes(1);
  expect(onProcessEnd).not.toHaveBeenCalled();

  // then first call replies...
  forkInterface.emit('message', [PARENT_MESSAGE_OK]);

  expect(onProcessEnd).toHaveBeenCalledTimes(1);
});

it('calls the onProcessStart method only when the request is starting to be processed', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const onProcessStart1 = jest.fn();
  const onProcessEnd1 = jest.fn();

  const onProcessStart2 = jest.fn();
  const onProcessEnd2 = jest.fn();

  worker.send(
    [CHILD_MESSAGE_CALL, false, 'foo', []],
    onProcessStart1,
    onProcessEnd1,
  );
  worker.send(
    [CHILD_MESSAGE_CALL, false, 'bar', []],
    onProcessStart2,
    onProcessEnd2,
  );

  // Not called yet since the second request is on the queue.
  expect(onProcessStart2).not.toHaveBeenCalled();

  // then first call replies...
  forkInterface.emit('message', [PARENT_MESSAGE_OK]);

  // Now it's been called.
  expect(onProcessStart2).toHaveBeenCalledTimes(1);
});

it('creates error instances for known errors', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  const callback1 = jest.fn();
  const callback2 = jest.fn();
  const callback3 = jest.fn();

  // Testing a generic ECMAScript error.
  worker.send([CHILD_MESSAGE_CALL, false, 'method', []], () => {}, callback1);

  forkInterface.emit('message', [
    PARENT_MESSAGE_ERROR,
    'TypeError',
    'bar',
    'TypeError: bar',
    {},
  ]);

  expect(callback1.mock.calls[0][0]).toBeInstanceOf(TypeError);
  expect(callback1.mock.calls[0][0].message).toBe('bar');
  expect(callback1.mock.calls[0][0].type).toBe('TypeError');
  expect(callback1.mock.calls[0][0].stack).toBe('TypeError: bar');

  // Testing a custom error.
  worker.send([CHILD_MESSAGE_CALL, false, 'method', []], () => {}, callback2);

  forkInterface.emit('message', [
    PARENT_MESSAGE_ERROR,
    'RandomCustomError',
    'bar',
    'RandomCustomError: bar',
    {qux: 'extra property'},
  ]);

  expect(callback2.mock.calls[0][0]).toBeInstanceOf(Error);
  expect(callback2.mock.calls[0][0].message).toBe('bar');
  expect(callback2.mock.calls[0][0].type).toBe('RandomCustomError');
  expect(callback2.mock.calls[0][0].stack).toBe('RandomCustomError: bar');
  expect(callback2.mock.calls[0][0].qux).toBe('extra property');

  // Testing a non-object throw.
  worker.send([CHILD_MESSAGE_CALL, false, 'method', []], () => {}, callback3);

  forkInterface.emit('message', [
    PARENT_MESSAGE_ERROR,
    'Number',
    null,
    null,
    412,
  ]);

  expect(callback3.mock.calls[0][0]).toBe(412);
});

it('throws when the child process returns a strange message', () => {
  const worker = new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  worker.send([CHILD_MESSAGE_CALL, false, 'method', []], () => {}, () => {});

  // Type 27 does not exist.
  expect(() => {
    forkInterface.emit('message', [27]);
  }).toThrow(TypeError);
});

it('does not restart the child if it cleanly exited', () => {
  new Worker({
    forkOptions: {},
    maxRetries: 3,
    workerPath: '/tmp/foo',
  });

  expect(childProcess.fork).toHaveBeenCalledTimes(1);
  forkInterface.emit('exit', 0);
  expect(childProcess.fork).toHaveBeenCalledTimes(1);
});

it('restarts the child when the child process dies', () => {
  new Worker({
    workerPath: '/tmp/foo',
  });

  expect(childProcess.fork).toHaveBeenCalledTimes(1);
  forkInterface.emit('exit', 1);
  expect(childProcess.fork).toHaveBeenCalledTimes(2);
});
