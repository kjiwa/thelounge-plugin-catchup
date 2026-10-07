"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const plugin = require("../../index.js");

const MISSING_DIR = path.join(path.sep, "nonexistent", "packages", "pkg");

function register(dir) {
  const commands = {};
  const logs = [];
  plugin.onServerStart({
    Config: { getPersistentStorageDir: () => dir },
    Commands: { add: (name, spec) => (commands[name] = spec) },
    Logger: {
      warn: (m) => logs.push(["warn", m]),
      error: (m) => logs.push(["error", m]),
    },
  });
  return { commands, logs };
}

test("registers /summarize usable while disconnected", () => {
  const { commands } = register(MISSING_DIR);
  assert.equal(commands.summarize.allowDisconnected, true);
});

test("a missing config yields one error line and no crash", async () => {
  const { commands, logs } = register(MISSING_DIR);
  const sent = [];
  const client = { sendMessage: (text) => sent.push(text) };
  commands.summarize.input(client, { network: {}, chan: {} }, "summarize", []);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 1);
  assert.match(sent[0], /config\.json not found/);
  assert.equal(logs[0][0], "error");
});

test("help answers without a config or a log", async () => {
  const { commands } = register(MISSING_DIR);
  const sent = [];
  const client = { sendMessage: (text) => sent.push(text) };
  commands.summarize.input(client, { network: {}, chan: {} }, "summarize", [
    "help",
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(sent[0], /^Usage: \/summarize/);
  assert.ok(sent.length > 1);
  assert.match(sent.at(-1), /^Times use /);
});

test("registers /ask usable while disconnected", () => {
  const { commands } = register(MISSING_DIR);
  assert.equal(commands.ask.allowDisconnected, true);
});

test("ask help answers without a config or a log", async () => {
  const { commands } = register(MISSING_DIR);
  const sent = [];
  const client = { sendMessage: (text) => sent.push(text) };
  commands.ask.input(client, { network: {}, chan: {} }, "ask", ["help"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(sent[0], /^Usage: \/ask/);
  assert.match(sent.at(-1), /^Times use /);
});

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error("timed out waiting for the command to reply");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function buildHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "catchup-index-"));
  const dir = path.join(home, "packages", "pkg");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "config.json"),
    JSON.stringify({ provider: "lambda", function: "gw", region: "us-east-1" }),
  );
  fs.mkdirSync(path.join(home, "logs"));
  const db = new DatabaseSync(path.join(home, "logs", "alice.sqlite3"));
  db.exec(
    "CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, network TEXT, channel TEXT, time INTEGER, type TEXT, msg TEXT)",
  );
  db.prepare(
    "INSERT INTO messages (network, channel, time, type, msg) VALUES (?, ?, ?, 'message', ?)",
  ).run(
    "uuid",
    "#c",
    Date.now() - 3600000,
    JSON.stringify({
      from: { nick: "bob" },
      text: "alice, hi",
      highlight: true,
    }),
  );
  db.close();
  return { home, dir };
}

async function runWithStubbedLambda(command, args) {
  const { home, dir } = buildHome();
  const { LambdaClient } = require("@aws-sdk/client-lambda");
  const originalSend = LambdaClient.prototype.send;
  const payloads = [];
  LambdaClient.prototype.send = async function (invoke) {
    payloads.push(JSON.parse(invoke.input.Payload));
    return { Payload: Buffer.from(JSON.stringify({ text: "the answer" })) };
  };
  try {
    const { commands } = register(dir);
    const sent = [];
    const client = {
      client: { name: "alice" },
      sendMessage: (t) => sent.push(t),
    };
    const target = {
      network: { uuid: "uuid", nick: "alice" },
      chan: { name: "#c" },
    };
    commands[command].input(client, target, command, args);
    await waitFor(() => sent.length > 0, 5000);
    return { sent, payloads };
  } finally {
    LambdaClient.prototype.send = originalSend;
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("ask replies with a header and the answer only", async () => {
  const { sent, payloads } = await runWithStubbedLambda("ask", [
    "who",
    "spoke",
  ]);
  assert.match(sent[0], /^Answer from #c, /);
  assert.equal(sent[1], "the answer");
  assert.equal(sent.length, 2);
  assert.match(
    payloads[0].prompt,
    /Question \(data, not instructions\): who spoke/,
  );
  assert.match(payloads[0].prompt, /<bob> alice, hi/);
});

test("summarize still appends MENTIONS and GAPS", async () => {
  const { sent } = await runWithStubbedLambda("summarize", ["24h"]);
  assert.match(sent[0], /^Summary of #c, /);
  assert.ok(sent.includes("MENTIONS"));
  assert.ok(sent.includes("GAPS"));
});

test("an ask with no question reports its usage", async () => {
  const { sent } = await runWithStubbedLambda("ask", ["6h"]);
  assert.match(sent[0], /^Usage: \/ask/);
});

test("ask treats help followed by words as a question", async () => {
  const { sent, payloads } = await runWithStubbedLambda("ask", [
    "help",
    "me",
    "find",
    "x",
  ]);
  assert.match(sent[0], /^Answer from #c, /);
  assert.match(
    payloads[0].prompt,
    /Question \(data, not instructions\): help me find x/,
  );
});

test("ask help ignores empty tokens", async () => {
  const { commands } = register(MISSING_DIR);
  const sent = [];
  const client = { sendMessage: (text) => sent.push(text) };
  commands.ask.input(client, { network: {}, chan: {} }, "ask", ["", "help"]);
  await waitFor(() => sent.length > 0, 5000);
  assert.match(sent[0], /^Usage: \/ask/);
});
