"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { parseWindow } = require("../../lib/window.js");

const HOUR = 3600000;
const NOW = new Date(2026, 5, 15, 14, 30, 0).getTime();
const ctx = (lastOwn) => ({
  nowMs: NOW,
  maxWindowHours: 24,
  findLastOwnMs: () => lastOwn,
});

const cases = [
  ["", ctx(NOW - 2 * HOUR), { fromMs: NOW - 2 * HOUR, nick: undefined }],
  ["since-last", ctx(NOW - HOUR), { fromMs: NOW - HOUR, nick: undefined }],
  [
    "since-last",
    ctx(NOW - 99 * HOUR),
    { fromMs: NOW - 24 * HOUR, nick: undefined },
  ],
  ["", ctx(undefined), { fromMs: NOW - 24 * HOUR, nick: undefined }],
  ["24h", ctx(), { fromMs: NOW - 24 * HOUR, nick: undefined }],
  ["9999h", ctx(), { fromMs: NOW - 24 * HOUR, nick: undefined }],
  ["6h bob", ctx(), { fromMs: NOW - 6 * HOUR, nick: "bob" }],
  ["bob", ctx(NOW - HOUR), { fromMs: NOW - HOUR, nick: "bob" }],
  [
    "today",
    ctx(),
    { fromMs: new Date(2026, 5, 15).getTime(), nick: undefined },
  ],
  [
    "since 09:05",
    ctx(),
    { fromMs: new Date(2026, 5, 15, 9, 5).getTime(), nick: undefined },
  ],
  [
    "since 23:00 carol",
    ctx(),
    { fromMs: new Date(2026, 5, 14, 23, 0).getTime(), nick: "carol" },
  ],
];

for (const [input, context, expected] of cases) {
  test(`parseWindow(${JSON.stringify(input)})`, () => {
    const got = parseWindow(input.split(" "), context);
    assert.equal(got.fromMs, expected.fromMs);
    assert.equal(got.nick, expected.nick);
    assert.equal(got.toMs, NOW);
  });
}

for (const bad of ["0h", "since", "since 25:00", "since 9", "6h bob carol"]) {
  test(`parseWindow rejects ${JSON.stringify(bad)}`, () => {
    assert.throws(() => parseWindow(bad.split(" "), ctx()), /Usage/);
  });
}
