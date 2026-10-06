"use strict";

// The AI SDK packages are ESM-only and heavy (about 35 MB RSS), so each
// factory imports them on first use.
const PROVIDERS = {
  async bedrock(config) {
    const { createAmazonBedrock } = await import("@ai-sdk/amazon-bedrock");
    const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
    return createAmazonBedrock({
      region: config.region,
      credentialProvider: fromNodeProviderChain(),
    }).languageModel(config.model);
  },
  async anthropic(config) {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    return createAnthropic().languageModel(config.model);
  },
};

// Always a model object: a bare string would route through the Vercel gateway.
async function createModel(config) {
  const factory = Object.hasOwn(PROVIDERS, config.provider)
    ? PROVIDERS[config.provider]
    : undefined;
  if (!factory) {
    throw new Error(`Unknown provider: ${config.provider}`);
  }
  return factory(config);
}

module.exports = { createModel };
