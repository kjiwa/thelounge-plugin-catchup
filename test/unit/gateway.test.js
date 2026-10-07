"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createLambdaClient, invokeGateway } = require("../../lib/gateway.js");

const CONFIG = { provider: "lambda", function: "gw", region: "us-west-2" };
const REQUEST = { system: "sys", prompt: "hello" };

function stubClient(response) {
  const calls = [];
  const client = {
    calls,
    destroyed: false,
    async send(command, options) {
      calls.push({ input: command.input, options });
      if (response instanceof Error) {
        throw response;
      }
      return response;
    },
    destroy() {
      client.destroyed = true;
    },
  };
  return client;
}

function reply(body, extra = {}) {
  return { Payload: Buffer.from(JSON.stringify(body)), ...extra };
}

test("invokes the function with {system, prompt} and returns text", async () => {
  const client = stubClient(reply({ text: "summary" }));
  const result = await invokeGateway(CONFIG, REQUEST, () => client);
  assert.deepEqual(result, { text: "summary", cut: false });
  assert.equal(client.calls[0].input.FunctionName, "gw");
  assert.deepEqual(JSON.parse(client.calls[0].input.Payload), REQUEST);
  assert.ok(client.calls[0].options.abortSignal);
  assert.equal(client.destroyed, true);
});

test("cut is true only for a boolean true", async () => {
  for (const [cut, expected] of [
    [true, true],
    ["true", false],
    [1, false],
  ]) {
    const client = stubClient(reply({ text: "t", cut }));
    const result = await invokeGateway(CONFIG, REQUEST, () => client);
    assert.equal(result.cut, expected);
  }
});

test("the client targets the region with the dual-stack endpoint", async () => {
  const client = createLambdaClient(CONFIG, {});
  assert.equal(await client.config.useDualstackEndpoint(), true);
  assert.equal(await client.config.region(), "us-west-2");
  const endpoint = await client.config.endpointProvider({
    Region: "us-west-2",
    UseDualStack: true,
    UseFIPS: false,
  });
  assert.equal(endpoint.url.hostname, "lambda.us-west-2.api.aws");
  client.destroy();
});

test("a custom endpoint turns dual-stack off", async () => {
  for (const env of [
    { AWS_ENDPOINT_URL_LAMBDA: "http://127.0.0.1:1" },
    { AWS_ENDPOINT_URL: "http://127.0.0.1:1" },
  ]) {
    const client = createLambdaClient(CONFIG, env);
    assert.equal(await client.config.useDualstackEndpoint(), false);
    client.destroy();
  }
});

test("a FunctionError reply is an error", async () => {
  const client = stubClient(
    reply({ errorMessage: "boom" }, { FunctionError: "Unhandled" }),
  );
  await assert.rejects(
    invokeGateway(CONFIG, REQUEST, () => client),
    (err) =>
      err.name === "GatewayFunctionError" && /Unhandled/.test(err.message),
  );
  assert.equal(client.destroyed, true);
});

test("a reply without text is an error", async () => {
  const client = stubClient(reply({}));
  await assert.rejects(
    invokeGateway(CONFIG, REQUEST, () => client),
    /no text/,
  );
});

test("a client failure propagates", async () => {
  const failure = Object.assign(new Error("denied"), { name: "AccessDenied" });
  const client = stubClient(failure);
  await assert.rejects(
    invokeGateway(CONFIG, REQUEST, () => client),
    failure,
  );
  assert.equal(client.destroyed, true);
});

test("an unparseable, null or empty gateway reply is an error", async () => {
  for (const body of ["not json", "null", '{"text":""}', '{"text":"  "}']) {
    const client = {
      send: async () => ({ Payload: Buffer.from(body) }),
      destroy() {},
    };
    await assert.rejects(
      invokeGateway(
        { function: "f", region: "r" },
        { system: "s", prompt: "p" },
        () => client,
      ),
      /no text/,
    );
  }
});
