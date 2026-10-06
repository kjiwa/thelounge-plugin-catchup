"use strict";

const { UserError } = require("./errors.js");
const { stamp } = require("./prompt.js");

function sendLines(publicClient, chan, text) {
  text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line !== "")
    .forEach((line) => publicClient.sendMessage(line, chan));
}

function summaryHeader({ channel, count, fromMs, toMs, truncated }) {
  const note = truncated ? "; input too large, newest part only" : "";
  return `Summary of ${channel}, ${stamp(fromMs)} to ${stamp(toMs)} (${count} lines${note}):`;
}

// Provider errors are logged for the operator and never echoed to the channel.
function sendError(publicClient, chan, err, logger) {
  if (err instanceof UserError) {
    publicClient.sendMessage(err.message, chan);
    return;
  }
  logger.error(
    `${err.name} (status ${err.statusCode ?? "n/a"}): ${err.message}`,
  );
  publicClient.sendMessage(
    "Summary failed; see the server log for details.",
    chan,
  );
}

module.exports = { sendLines, sendError, summaryHeader };
