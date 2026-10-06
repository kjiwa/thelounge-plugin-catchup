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
