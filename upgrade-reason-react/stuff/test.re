open Jest;

open ExpectJs;

test("basename()", () =>
  expect(Mypath.basename("/foo/bar/baz/asdf/quux.html", ()))
  |> toEqual("quux.html")
);

  test("basename()", () =>
  expect(Mypath.basename("/foo/bar/baz/asdf/quux.html", ()))
  |> toEqual("quux.html")
);

let a = 7;