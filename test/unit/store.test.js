"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { openLog, fetchLines, findLastOwnMs } = require("../../lib/store.js");

const UUID = "00000000-0000-4000-8000-000000000001";
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);

function buildHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "catchup-store-"));
  fs.mkdirSync(path.join(home, "logs"));
  const db = new DatabaseSync(path.join(home, "logs", "alice.sqlite3"));
  db.exec(
    "CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, network TEXT, channel TEXT, time INTEGER, type TEXT, msg TEXT)",
  );
  const insert = db.prepare(
    "INSERT INTO messages (network, channel, time, type, msg) VALUES (?, ?, ?, ?, ?)",
  );
  const add = (uuid, chan, min, type, nick, text, extra = {}) =>
    insert.run(
      uuid,
      chan,
      T0 + min * 60000,
      type,
      JSON.stringify({ from: { nick }, text, ...extra }),
    );
  add(UUID, "#fixture", 0, "message", "bob", "hello");
  add(UUID, "#fixture", 1, "action", "carol", "waves");
  add(UUID, "#fixture", 2, "join", "dave", "");
  add(UUID, "#fixture", 3, "message", "Alice", "mine", { self: true });
  add(UUID, "#fixture", 4, "message", "bob", "hi alice", { highlight: true });
  add(UUID, "#fixture", 5, "topic", "bob", "new topic");
  add(UUID, "#other", 1, "message", "bob", "elsewhere");
  add("other-uuid", "#fixture", 1, "message", "bob", "other network");
  db.close();
  return home;
}

test("fetchLines returns only this channel's spoken types, oldest first", (t) => {
  const home = buildHome();
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const db = openLog(home, "alice");
  t.after(() => db.close());
  const lines = fetchLines(db, {
    networkUuid: UUID,
    channel: "#Fixture",
    fromMs: T0,
    toMs: T0 + 10 * 60000,
  });
  assert.deepEqual(
    lines.map((l) => [l.type, l.nick, l.text, l.highlight]),
    [
      ["message", "bob", "hello", false],
      ["action", "carol", "waves", false],
      ["message", "Alice", "mine", false],
      ["message", "bob", "hi alice", true],
      ["topic", "bob", "new topic", false],
    ],
  );
});

test("fetchLines honors the half-open time window", (t) => {
  const home = buildHome();
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const db = openLog(home, "alice");
  t.after(() => db.close());
  const lines = fetchLines(db, {
    networkUuid: UUID,
    channel: "#fixture",
    fromMs: T0 + 1 * 60000,
    toMs: T0 + 4 * 60000,
  });
  assert.deepEqual(
    lines.map((l) => l.text),
    ["waves", "mine"],
  );
});

test("findLastOwnMs matches the nick case-insensitively", (t) => {
  const home = buildHome();
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const db = openLog(home, "alice");
  t.after(() => db.close());
  const query = {
    networkUuid: UUID,
    channel: "#fixture",
    fromMs: T0 - 60000,
    toMs: T0 + 10 * 60000,
  };
  assert.equal(findLastOwnMs(db, query, "alice"), T0 + 3 * 60000);
  assert.equal(findLastOwnMs(db, query, "nobody"), undefined);
});

test("the log opens read-only", (t) => {
  const home = buildHome();
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const db = openLog(home, "alice");
  t.after(() => db.close());
  assert.throws(() => db.exec("DELETE FROM messages"), /readonly/i);
});

test("a missing log is a one-line user error", () => {
  assert.throws(() => openLog(os.tmpdir(), "no-such-user-xyz"), /No sqlite/);
});
