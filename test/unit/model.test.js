"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createModel } = require("../../lib/model.js");

test("bedrock yields a model object, never a string", async () => {
  const model = await createModel({
    provider: "bedrock",
    model: "us.example-model-v1:0",
    region: "us-west-2",
  });
  assert.notEqual(typeof model, "string");
  assert.equal(typeof model, "object");
  assert.equal(model.modelId, "us.example-model-v1:0");
});

test("anthropic yields a model object, never a string", async () => {
  const model = await createModel({
    provider: "anthropic",
    model: "example-model",
  });
  assert.notEqual(typeof model, "string");
  assert.equal(typeof model, "object");
  assert.equal(model.modelId, "example-model");
});

test("an unknown provider throws", async () => {
  await assert.rejects(
    createModel({ provider: "gateway", model: "x" }),
    /Unknown provider/,
  );
  await assert.rejects(
    createModel({ provider: "toString", model: "x" }),
    /Unknown provider/,
  );
});

test("openai-compatible yields a model object, never a string", async () => {
  const model = await createModel({
    provider: "openai-compatible",
    model: "example-model",
    baseURL: "http://127.0.0.1:11434/v1",
  });
  assert.notEqual(typeof model, "string");
  assert.equal(typeof model, "object");
  assert.equal(model.modelId, "example-model");
});
