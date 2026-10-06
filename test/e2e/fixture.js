"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const USER = "alice";
const NETWORK_UUID = "00000000-0000-4000-8000-000000000001";
const CHANNEL = "#fixture";
const BASE_TIME = Date.UTC(2026, 0, 1, 12, 0, 0);
const MESSAGES = [
  ["bob", "hello from the fixture"],
  ["carol", "synthetic line two"],
  ["bob", "synthetic line three"],
];

function lounge(name) {
  return path.join(
    path.dirname(require.resolve("thelounge/package.json")),
    "dist",
    "server",
    name,
  );
}

function writeUser(home, password) {
  const file = path.join(home, "users", `${USER}.json`);
  const user = JSON.parse(fs.readFileSync(file, "utf8"));
  user.networks = [
    {
      uuid: NETWORK_UUID,
      name: "fixture",
      host: "127.0.0.1",
      port: 1,
      tls: false,
      nick: USER,
      channels: [{ name: CHANNEL }],
    },
  ];
  fs.writeFileSync(file, JSON.stringify(user, null, "\t"));
  return password;
}

function writeConfig(home, port) {
  fs.writeFileSync(
    path.join(home, "config.js"),
    `module.exports = { public: false, host: "127.0.0.1", port: ${port}, ` +
      `messageStorage: ["sqlite"], prefetch: false };\n`,
  );
}

function writeLog(home) {
  const { currentSchemaVersion } = require(
    lounge("plugins/messageStorage/sqlite.js"),
  );
  fs.mkdirSync(path.join(home, "logs"), { recursive: true });
  const db = new DatabaseSync(path.join(home, "logs", `${USER}.sqlite3`));
  db.exec(
    "CREATE TABLE options (name TEXT, value TEXT, CONSTRAINT name_unique UNIQUE (name))",
  );
  db.exec(
    "CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, network TEXT, channel TEXT, time INTEGER, type TEXT, msg TEXT)",
  );
  db.exec(
    "CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, version INTEGER NOT NULL UNIQUE, rollback_forbidden INTEGER DEFAULT 0 NOT NULL)",
  );
  db.exec(
    "CREATE TABLE rollback_steps (id INTEGER PRIMARY KEY AUTOINCREMENT, migration_id INTEGER NOT NULL REFERENCES migrations ON DELETE CASCADE, step INTEGER NOT NULL, statement TEXT NOT NULL)",
  );
  db.exec("CREATE INDEX time ON messages (time)");
  db.exec("CREATE INDEX msg_type_idx on messages (type)");
  db.exec(
    "CREATE INDEX network_channel_time ON messages (network, channel, time)",
  );
  db.prepare(
    "INSERT INTO options (name, value) VALUES ('schema_version', ?)",
  ).run(String(currentSchemaVersion));
  const insert = db.prepare(
    "INSERT INTO messages (network, channel, time, type, msg) VALUES (?, ?, ?, 'message', ?)",
  );
  MESSAGES.forEach(([nick, text], i) => {
    const msg = JSON.stringify({ from: { nick }, text });
    insert.run(NETWORK_UUID, CHANNEL, BASE_TIME + i * 60000, msg);
  });
  db.close();
}

module.exports = {
  USER,
  CHANNEL,
  MESSAGES,
  writeUser,
  writeConfig,
  writeLog,
};
