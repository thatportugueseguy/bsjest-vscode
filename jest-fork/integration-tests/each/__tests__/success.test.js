/**
 * Copyright (c) 2018-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

it.each([[true, true], [true, true]])(
  'passes one row expected %s == %s',
  (left, right) => {
    expect(left).toBe(right);
  }
);

it.each([[true, true], [true, true]])(
  'passes all rows expected %s == %s',
  (left, right) => {
    expect(left).toBe(right);
  }
);

describe.each([[true, true], [true, true]])(
  'passes all rows expected %s == %s',
  (left, right) => {
    it('passes', () => {
      expect(left).toBe(right);
    });
  }
);

it.each`
  left    | right
  ${true} | ${true}
  ${true} | ${true}
`('passes one row expected $left == $right', ({left, right}) => {
  expect(left).toBe(right);
});

it.each`
  left    | right
  ${true} | ${true}
  ${true} | ${true}
`('passes all rows expected $left == $right', ({left, right}) => {
  expect(left).toBe(right);
});

describe.each`
  left    | right
  ${true} | ${true}
  ${true} | ${true}
`('passes all rows expected $left == $right', ({left, right}) => {
  it('passes ', () => {
    expect(left).toBe(right);
  });
});
