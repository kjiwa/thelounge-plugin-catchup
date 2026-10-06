"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const { UserError } = require("./errors.js");

const SPOKEN_TYPES = ["message", "action", "topic"];
const PLACEHOLDERS = SPOKEN_TYPES.map(() => "?").join(", ");

function openLog(home, clientName) {
  const file = path.join(home, "logs", `${clientName}.sqlite3`);
  if (!fs.existsSync(file)) {
    throw new UserError("No sqlite message log found for your user");
  }
  return new DatabaseSync(file, { readOnly: true });
}

// Field names follow TheLounge's Msg model: from.nick, text, highlight, self.
function toLine(row) {
  const msg = JSON.parse(row.msg);
  return {
    time: row.time,
    type: row.type,
    nick: msg.from?.nick ?? "",
    text: msg.text ?? "",
    highlight: msg.highlight === true,
  };
}

function queryRows(db, { networkUuid, channel, fromMs, toMs }, order) {
  return db
    .prepare(
      `SELECT time, type, msg FROM messages
       WHERE network = ? AND channel = ? AND time >= ? AND time < ?
         AND type IN (${PLACEHOLDERS})
       ORDER BY time ${order}, id ${order}`,
    )
    .all(networkUuid, channel.toLowerCase(), fromMs, toMs, ...SPOKEN_TYPES);
}

function fetchLines(db, query) {
  return queryRows(db, query, "ASC").map(toLine);
}

function findLastOwnMs(db, query, nick) {
  const wanted = nick.toLowerCase();
  const own = queryRows(db, query, "DESC")
    .filter((row) => row.type !== "topic")
    .map(toLine)
    .find((line) => line.nick.toLowerCase() === wanted);
  return own?.time;
}

module.exports = { openLog, fetchLines, findLastOwnMs };
