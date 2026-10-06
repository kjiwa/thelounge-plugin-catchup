"use strict";

const TIMEOUT_MS = 60000;

function parseReply(response) {
  const body = Buffer.from(response.Payload ?? []).toString("utf8");
  if (response.FunctionError) {
    const err = new Error(`Lambda ${response.FunctionError}: ${body}`);
    err.name = "GatewayFunctionError";
    throw err;
  }
  let text;
  try {
    ({ text } = JSON.parse(body));
  } catch {
    text = undefined;
  }
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Gateway reply has no text");
  }
  return text;
}

// The SDK rejects dual-stack combined with a custom endpoint, so an operator
// or test endpoint override takes the place of the dual-stack default.
function usesCustomEndpoint(env) {
  return Boolean(env.AWS_ENDPOINT_URL_LAMBDA || env.AWS_ENDPOINT_URL);
}

function createLambdaClient(config, env = process.env) {
  const { LambdaClient } = require("@aws-sdk/client-lambda");
  return new LambdaClient({
    region: config.region,
    useDualstackEndpoint: !usesCustomEndpoint(env),
    maxAttempts: 2,
  });
}

async function invokeGateway(
  config,
  { system, prompt },
  createClient = createLambdaClient,
) {
  const { InvokeCommand } = require("@aws-sdk/client-lambda");
  const client = createClient(config);
  try {
    const response = await client.send(
      new InvokeCommand({
        FunctionName: config.function,
        Payload: JSON.stringify({ system, prompt }),
      }),
      { abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    return parseReply(response);
  } finally {
    client.destroy();
  }
}

module.exports = { invokeGateway, createLambdaClient };
