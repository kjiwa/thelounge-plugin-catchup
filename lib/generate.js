"use strict";

const MAX_OUTPUT_TOKENS = 1500;
const TIMEOUT_MS = 60000;

async function generate(model, { system, prompt }) {
  const { generateText } = await import("ai");
  const { text, finishReason } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { text, cut: finishReason === "length" };
}

module.exports = { generate };
