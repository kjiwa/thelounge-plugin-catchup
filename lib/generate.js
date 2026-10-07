"use strict";

const MAX_OUTPUT_TOKENS = 1500;

async function generate(model, { system, prompt }, signal) {
  const { generateText } = await import("ai");
  const { text, finishReason } = await generateText({
    model,
    system,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    abortSignal: signal,
  });
  if (text.trim() === "") {
    throw new Error("Model reply has no text");
  }
  return { text, cut: finishReason === "length" };
}

module.exports = { generate };
