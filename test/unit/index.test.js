"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const path = require("node:path");

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
