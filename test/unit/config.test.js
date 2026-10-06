"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { validateConfig } = require("../../lib/config.js");

test("bedrock config falls back to AWS_REGION and defaults the window", () => {
  const { config, unknownKeys } = validateConfig(
    { provider: "bedrock", model: "m" },
    { AWS_REGION: "us-west-2" },
  );
  assert.deepEqual(config, {
    provider: "bedrock",
    model: "m",
    region: "us-west-2",
    maxWindowHours: 24,
  });
  assert.deepEqual(unknownKeys, []);
});

test("explicit region and maxWindowHours win", () => {
  const { config } = validateConfig(
    { provider: "bedrock", model: "m", region: "eu-west-1", maxWindowHours: 6 },
    { AWS_REGION: "us-west-2" },
  );
  assert.equal(config.region, "eu-west-1");
  assert.equal(config.maxWindowHours, 6);
});

test("anthropic needs ANTHROPIC_API_KEY in the environment", () => {
  const raw = { provider: "anthropic", model: "m" };
  assert.throws(() => validateConfig(raw, {}), /ANTHROPIC_API_KEY/);
  const { config } = validateConfig(raw, { ANTHROPIC_API_KEY: "k" });
  assert.equal(config.region, undefined);
});

test("unknown keys are reported, not rejected", () => {
  const { unknownKeys } = validateConfig(
    { provider: "anthropic", model: "m", apiKey: "x" },
    { ANTHROPIC_API_KEY: "k" },
  );
  assert.deepEqual(unknownKeys, ["apiKey"]);
});

const invalid = [
  [null, /JSON object/],
  [{ model: "m" }, /provider/],
  [{ provider: "openai", model: "m" }, /provider/],
  [{ provider: "bedrock" }, /model/],
  [{ provider: "bedrock", model: "m" }, /region/],
  [
    { provider: "bedrock", model: "m", region: "r", maxWindowHours: 0 },
    /maxWindowHours/,
  ],
];
for (const [raw, pattern] of invalid) {
  test(`rejects ${JSON.stringify(raw)}`, () => {
    assert.throws(() => validateConfig(raw, {}), pattern);
  });
}

test("lambda needs a function and a region, and takes no model", () => {
  const { config, unknownKeys } = validateConfig(
    { provider: "lambda", function: "gw" },
    { AWS_REGION: "us-west-2" },
  );
  assert.deepEqual(config, {
    provider: "lambda",
    function: "gw",
    region: "us-west-2",
    maxWindowHours: 24,
  });
  assert.deepEqual(unknownKeys, []);
  const { config: explicit } = validateConfig(
    {
      provider: "lambda",
      function: "arn:aws:lambda:us-west-1:123456789012:function:gw",
      region: "us-west-1",
    },
    {},
  );
  assert.equal(explicit.region, "us-west-1");
});

test("lambda rejects a missing function or region", () => {
  assert.throws(
    () => validateConfig({ provider: "lambda", region: "r" }, {}),
    /function/,
  );
  assert.throws(
    () => validateConfig({ provider: "lambda", function: "gw" }, {}),
    /region/,
  );
});

test("function is a known key", () => {
  const { unknownKeys } = validateConfig(
    { provider: "lambda", function: "gw", region: "r", model: "m" },
    {},
  );
  assert.deepEqual(unknownKeys, []);
});

test("timeZone is kept when valid and omitted when absent", () => {
  const raw = { provider: "bedrock", model: "m", region: "r" };
  const set = validateConfig({ ...raw, timeZone: "America/Los_Angeles" }, {});
  assert.equal(set.config.timeZone, "America/Los_Angeles");
  assert.deepEqual(set.unknownKeys, []);
  assert.equal("timeZone" in validateConfig(raw, {}).config, false);
});

for (const timeZone of ["Mars/Base", "", 5]) {
  test(`rejects timeZone ${JSON.stringify(timeZone)}`, () => {
    const raw = { provider: "bedrock", model: "m", region: "r", timeZone };
    assert.throws(() => validateConfig(raw, {}), /timeZone/);
  });
}
