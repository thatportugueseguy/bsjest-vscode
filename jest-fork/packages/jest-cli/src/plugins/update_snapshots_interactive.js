/**
 * Copyright (c) 2014-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */
import type {JestHookSubscriber} from '../jest_hooks';
import type {GlobalConfig} from 'types/Config';
import type {AggregatedResult, AssertionLocation} from 'types/TestResult';
import BaseWatchPlugin from '../base_watch_plugin';
import SnapshotInteractiveMode from '../snapshot_interactive_mode';

class UpdateSnapshotInteractivePlugin extends BaseWatchPlugin {
  _snapshotInteractiveMode: SnapshotInteractiveMode;
  _failedSnapshotTestPaths: Array<*>;
  _failedSnapshotTestAssertions: Array<AssertionLocation>;
  isInternal: true;

  constructor(options: {
    stdin: stream$Readable | tty$ReadStream,
    stdout: stream$Writable | tty$WriteStream,
  }) {
    super(options);
    this._failedSnapshotTestAssertions = [];
    this._snapshotInteractiveMode = new SnapshotInteractiveMode(this._stdout);
    this.isInternal = true;
  }

  getFailedSnapshotTestAssertions(
    testResults: AggregatedResult,
  ): Array<AssertionLocation> {
    const failedTestPaths = [];
    if (testResults.numFailedTests === 0 || !testResults.testResults) {
      return failedTestPaths;
    }

    testResults.testResults.forEach(testResult => {
      if (testResult.snapshot && testResult.snapshot.unmatched) {
        testResult.testResults.forEach(result => {
          if (result.status === 'failed') {
            failedTestPaths.push({
              path: testResult.testFilePath,
              title: result.title,
            });
          }
        });
      }
    });

    return failedTestPaths;
  }

  apply(hooks: JestHookSubscriber) {
    hooks.testRunComplete(results => {
      this._failedSnapshotTestAssertions = this.getFailedSnapshotTestAssertions(
        results,
      );
      if (this._snapshotInteractiveMode.isActive()) {
        this._snapshotInteractiveMode.updateWithResults(results);
      }
    });
  }

  onKey(key: string) {
    if (this._snapshotInteractiveMode.isActive()) {
      this._snapshotInteractiveMode.put(key);
    }
  }

  run(globalConfig: GlobalConfig, updateConfigAndRun: Function): Promise<void> {
    if (this._failedSnapshotTestAssertions.length) {
      return new Promise(res => {
        this._snapshotInteractiveMode.run(
          this._failedSnapshotTestAssertions,
          (assertion: ?AssertionLocation, shouldUpdateSnapshot: boolean) => {
            updateConfigAndRun({
              mode: 'watch',
              testNamePattern: assertion ? `^${assertion.title}$` : '',
              testPathPattern: assertion ? assertion.path : '',

              updateSnapshot: shouldUpdateSnapshot ? 'all' : 'none',
            });
            if (!this._snapshotInteractiveMode.isActive()) {
              res();
            }
          },
        );
      });
    } else {
      return Promise.resolve();
    }
  }

  getUsageInfo(globalConfig: GlobalConfig) {
    if (
      this._failedSnapshotTestAssertions &&
      this._failedSnapshotTestAssertions.length > 0
    ) {
      return {
        key: 'i'.codePointAt(0),
        prompt: 'update failing snapshots interactively',
      };
    }

    return null;
  }
}

export default UpdateSnapshotInteractivePlugin;
