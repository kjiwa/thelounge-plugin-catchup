"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const plugin = require("../../index.js");

test("onServerStart is a function that registers nothing yet", () => {
  assert.equal(typeof plugin.onServerStart, "function");
  assert.doesNotThrow(() => plugin.onServerStart({}));
});
