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

test("the header stamps both ends in the configured zone", () => {
  const header = summaryHeader({
    channel: "#c",
    count: 3,
    fromMs: Date.UTC(2026, 0, 1, 8),
    toMs: Date.UTC(2026, 0, 2, 8),
    truncated: false,
    timeZone: "America/Los_Angeles",
  });
  assert.match(header, /2026-01-01 00:00 to 2026-01-02 00:00/);
});

test("the header counts 1 line in the singular", () => {
  const base = { channel: "#c", fromMs: 0, toMs: 60000, truncated: false };
  assert.match(summaryHeader({ ...base, count: 1 }), /\(1 line\)/);
  assert.match(summaryHeader({ ...base, count: 2 }), /\(2 lines\)/);
});

test("the header notes a capped window", () => {
  const base = { channel: "#c", count: 3, truncated: false, fromMs: 0 };
  const toMs = 24 * 3600000;
  assert.match(
    summaryHeader({ ...base, toMs, capped: true }),
    /\(3 lines; capped at 24h, the maxWindowHours limit\)/,
  );
  assert.doesNotMatch(
    summaryHeader({ ...base, toMs, capped: false }),
    /capped/,
  );
});

test("sendLines drops model lines that say Open: none", () => {
  const client = recorder();
  sendLines(
    client,
    "chan",
    "a\n  Open: None.\nopen: none\n   Open: a question",
  );
  assert.deepEqual(
    client.sent.map(([text]) => text),
    ["a", "   Open: a question"],
  );
});

test("summaryHeader says 1 line in the singular", () => {
  const base = { channel: "#c", fromMs: 0, toMs: 60000, timeZone: "UTC" };
  assert.match(summaryHeader({ ...base, count: 1 }), /\(1 line\)/);
  assert.match(summaryHeader({ ...base, count: 2 }), /\(2 lines\)/);
});

test("the header title defaults to Summary of and can be replaced", () => {
  const base = { channel: "#c", count: 3, fromMs: 0, toMs: 60000 };
  assert.match(summaryHeader(base), /^Summary of #c, /);
  assert.match(
    summaryHeader({ ...base, title: "Answer from" }),
    /^Answer from #c, /,
  );
});
