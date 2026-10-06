"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { zonedParts, zonedTime } = require("../../lib/clock.js");

const LA = "America/Los_Angeles";
const HOUR = 3600000;

function midnight(y, m, d) {
  return zonedTime({ y, m, d }, LA);
}

test("Los Angeles midnight on a normal day", () => {
  assert.equal(midnight(2026, 6, 10), Date.UTC(2026, 5, 10, 7));
  assert.equal(midnight(2026, 1, 10), Date.UTC(2026, 0, 10, 8));
});

test("the spring-forward day is 23 hours", () => {
  assert.equal(midnight(2026, 3, 8), Date.UTC(2026, 2, 8, 8));
  assert.equal((midnight(2026, 3, 9) - midnight(2026, 3, 8)) / HOUR, 23);
});

test("the fall-back day is 25 hours", () => {
  assert.equal(midnight(2026, 11, 1), Date.UTC(2026, 10, 1, 7));
  assert.equal((midnight(2026, 11, 2) - midnight(2026, 11, 1)) / HOUR, 25);
});

test("next-day rollover crosses month and year ends", () => {
  assert.equal(
    zonedTime({ y: 2026, m: 12, d: 32 }, LA),
    zonedTime({ y: 2027, m: 1, d: 1 }, LA),
  );
});

test("parts round-trip through zonedTime", () => {
  for (const ms of [
    Date.UTC(2026, 10, 1, 12, 45),
    Date.UTC(2026, 2, 8, 12, 45),
    Date.UTC(2026, 5, 10, 3, 5),
  ]) {
    assert.equal(zonedTime(zonedParts(ms, LA), LA), ms);
  }
});

test("parts render h23 hours and read in the requested zone", () => {
  const ms = Date.UTC(2026, 5, 10, 7, 5);
  assert.deepEqual(zonedParts(ms, LA), {
    y: 2026,
    m: 6,
    d: 10,
    h: 0,
    min: 5,
  });
  assert.deepEqual(zonedParts(ms, "UTC"), {
    y: 2026,
    m: 6,
    d: 10,
    h: 7,
    min: 5,
  });
});

test("an undefined zone uses the server zone", () => {
  const ms = new Date(2026, 5, 10, 13, 7).getTime();
  assert.deepEqual(zonedParts(ms, undefined), {
    y: 2026,
    m: 6,
    d: 10,
    h: 13,
    min: 7,
  });
  assert.equal(zonedTime({ y: 2026, m: 6, d: 10, h: 13, min: 7 }), ms);
});
