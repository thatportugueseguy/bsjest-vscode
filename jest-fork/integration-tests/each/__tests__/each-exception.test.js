/**
 * Copyright (c) 2018-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

it.each`
  left    | right
  ${true} | ${true}
  ${true} |
`(
  'throws exception when not enough arguments are supplied $left == $right',
  ({left, right}) => {
    expect(left).toBe(right);
  }
);
