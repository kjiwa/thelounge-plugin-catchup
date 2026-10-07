"use strict";

const MAX_OUTPUT_TOKENS = 1500;

async function generate(model, { system, prompt }, timeoutSeconds) {
  const { generateText } = await import("ai");
  const { text, finishReason } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(timeoutSeconds * 1000),
  });
  return { text, cut: finishReason === "length" };
}

module.exports = { generate };
