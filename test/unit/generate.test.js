"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { generate } = require("../../lib/generate.js");

const REQUEST = { system: "sys", prompt: "hello" };

async function mockModel(text, unified = "stop") {
  const { MockLanguageModelV4 } = await import("ai/test");
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified, raw: unified },
      usage: {
        inputTokens: { total: 1, noCache: 1 },
        outputTokens: { total: 1, text: 1 },
      },
      warnings: [],
    }),
  });
}

test("returns the text and flags a reply cut at the output limit", async () => {
  const signal = AbortSignal.timeout(5000);
  assert.deepEqual(await generate(await mockModel("hi"), REQUEST, signal), {
    text: "hi",
    cut: false,
  });
  const cut = await generate(await mockModel("hi", "length"), REQUEST, signal);
  assert.equal(cut.cut, true);
});

test("an empty reply is an error", async () => {
  await assert.rejects(
    generate(await mockModel("  "), REQUEST, AbortSignal.timeout(5000)),
    /no text/,
  );
});
