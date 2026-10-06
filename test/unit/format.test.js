"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { UserError } = require("../../lib/errors.js");
const { sendLines, sendError, summaryHeader } = require("../../lib/format.js");

function recorder() {
  const sent = [];
  return { sent, sendMessage: (text, chan) => sent.push([text, chan]) };
}

test("sendLines sends one message per line and one spacer per blank run", () => {
  const client = recorder();
  sendLines(client, "chan", "a\n\n\n b \nc  \n\n");
  assert.deepEqual(client.sent, [
    ["a", "chan"],
    ["\u00a0", "chan"],
    [" b", "chan"],
    ["c", "chan"],
  ]);
});

test("a user error is sent verbatim as one line", () => {
  const client = recorder();
  sendError(client, "chan", new UserError("bad window"), { error() {} });
  assert.deepEqual(client.sent, [["bad window", "chan"]]);
});

test("a provider error is logged and never echoed to the channel", () => {
  const client = recorder();
  const logged = [];
  const err = Object.assign(new Error("body: secret-token-123"), {
    name: "AI_APICallError",
    statusCode: 403,
  });
  sendError(client, "chan", err, { error: (m) => logged.push(m) });
  assert.equal(client.sent.length, 1);
  assert.doesNotMatch(client.sent[0][0], /secret|403/);
  assert.match(logged[0], /403/);
});

test("the header notes truncation", () => {
  const base = { channel: "#c", count: 3, fromMs: 0, toMs: 60000 };
  assert.doesNotMatch(
    summaryHeader({ ...base, truncated: false }),
    /too large/,
  );
  assert.match(summaryHeader({ ...base, truncated: true }), /too large/);
});
