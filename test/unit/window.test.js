"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseWindow,
  parseAskWindow,
  helpText,
} = require("../../lib/window.js");

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

const LA = "America/Los_Angeles";
const laCtx = (nowMs) => ({
  nowMs,
  maxWindowHours: 24,
  timeZone: LA,
  findLastOwnMs: () => undefined,
});
const LA_NOW = Date.UTC(2026, 5, 15, 21, 30);
const LA_MIDNIGHT = Date.UTC(2026, 5, 15, 7);

test("today and since HH:MM follow the configured zone", () => {
  assert.equal(parseWindow(["today"], laCtx(LA_NOW)).fromMs, LA_MIDNIGHT);
  assert.equal(
    parseWindow(["since", "09:05"], laCtx(LA_NOW)).fromMs,
    Date.UTC(2026, 5, 15, 16, 5),
  );
  assert.equal(
    parseWindow(["since", "23:00"], laCtx(LA_NOW)).fromMs,
    Date.UTC(2026, 5, 15, 6),
  );
});

test("a date window spans that calendar day in the zone", () => {
  const got = parseWindow(["2026-06-10"], laCtx(LA_NOW));
  assert.equal(got.fromMs, Date.UTC(2026, 5, 10, 7));
  assert.equal(got.toMs, Date.UTC(2026, 5, 11, 7));
  assert.equal(got.nick, undefined);
});

test("a date window takes a trailing nick", () => {
  assert.equal(parseWindow(["2026-06-10", "bob"], laCtx(LA_NOW)).nick, "bob");
});

test("today's date ends at now", () => {
  const got = parseWindow(["2026-06-15"], laCtx(LA_NOW));
  assert.equal(got.fromMs, LA_MIDNIGHT);
  assert.equal(got.toMs, LA_NOW);
});

test("a date older than maxWindowHours is not floored", () => {
  const got = parseWindow(["2026-06-01"], laCtx(LA_NOW));
  assert.equal(got.fromMs, Date.UTC(2026, 5, 1, 7));
  assert.equal(got.toMs, Date.UTC(2026, 5, 2, 7));
});

test("date windows on DST days span 23 and 25 hours", () => {
  const now = Date.UTC(2027, 0, 1);
  const spring = parseWindow(["2026-03-08"], laCtx(now));
  const fall = parseWindow(["2026-11-01"], laCtx(now));
  assert.equal((spring.toMs - spring.fromMs) / HOUR, 23);
  assert.equal((fall.toMs - fall.fromMs) / HOUR, 25);
});

for (const bad of [
  "2026-06-16",
  "2026-02-30",
  "2026-6-1",
  "2026-13-01",
  "0099-01-01",
]) {
  test(`parseWindow rejects date ${bad}`, () => {
    assert.throws(() => parseWindow([bad], laCtx(LA_NOW)), /Usage/);
  });
}

test("help text names the usage and the zone in effect", () => {
  const text = helpText(LA, "summarize", "1.2.3");
  assert.match(text, /^Usage: \/summarize/);
  assert.match(text, /YYYY-MM-DD/);
  assert.match(text, /Times use America\/Los_Angeles\.\n/);
  assert.match(text, /\nthelounge-plugin-catchup 1\.2\.3$/);
  assert.match(helpText(undefined, "summarize", "1.2.3"),/Times use \S+\.\n/);
});

test("parseWindow keeps a digit-dash nick as a nick", () => {
  assert.equal(parseWindow(["1-2-3"], ctx(NOW - HOUR)).nick, "1-2-3");
});

test("an explicit spec raised to the floor is capped; others are not", () => {
  assert.equal(parseWindow(["48h"], ctx()).capped, true);
  assert.equal(parseWindow(["9999h", "bob"], ctx()).capped, true);
  assert.equal(parseWindow(["24h"], ctx()).capped, false);
  assert.equal(parseWindow(["6h"], ctx()).capped, false);
});

test("the since-last floor is its definition, never a cap", () => {
  assert.equal(parseWindow([], ctx(NOW - 99 * HOUR)).capped, false);
  assert.equal(parseWindow([], ctx(undefined)).capped, false);
});

const askCases = [
  ["who won", { fromMs: NOW - 24 * HOUR, question: "who won" }],
  ["6h who won", { fromMs: NOW - 6 * HOUR, question: "who won" }],
  [
    "since 14:00 x",
    { fromMs: new Date(2026, 5, 15, 14, 0).getTime(), question: "x" },
  ],
  ["since when x", { fromMs: NOW - 24 * HOUR, question: "since when x" }],
  ["since-last x", { fromMs: NOW - 24 * HOUR, question: "since-last x" }],
  ["9999h x", { fromMs: NOW - 24 * HOUR, question: "x", capped: true }],
];

for (const [input, expected] of askCases) {
  test(`parseAskWindow(${JSON.stringify(input)})`, () => {
    const got = parseAskWindow(input.split(" "), ctx());
    assert.equal(got.fromMs, expected.fromMs);
    assert.equal(got.question, expected.question);
    assert.equal(got.toMs, NOW);
    assert.equal(got.capped ?? false, expected.capped ?? false);
  });
}

test("parseAskWindow accepts a question of exactly 500 characters", () => {
  const got = parseAskWindow(["x".repeat(500)], ctx());
  assert.equal(got.question.length, 500);
});

for (const bad of [[], [""], ["6h"], ["x".repeat(501)], ["0h", "x"]]) {
  test(`parseAskWindow rejects ${JSON.stringify(bad)}`, () => {
    assert.throws(() => parseAskWindow(bad, ctx()), /Usage: \/ask/);
  });
}

test("parseAskWindow keeps an explicit date window's own end", () => {
  const got = parseAskWindow(["2026-06-14", "x"], ctx());
  assert.equal(got.fromMs, new Date(2026, 5, 14).getTime());
  assert.equal(got.toMs, new Date(2026, 5, 15).getTime());
});

test("ask help names the ask usage and the zone in effect", () => {
  const text = helpText(LA, "ask", "1.2.3");
  assert.match(text, /^Usage: \/ask/);
  assert.doesNotMatch(text, /summarize/);
  assert.match(text, /Times use America\/Los_Angeles\.\n/);
  assert.match(text, /\nthelounge-plugin-catchup 1\.2\.3$/);
});
