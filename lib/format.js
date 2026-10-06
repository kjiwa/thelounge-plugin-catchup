"use strict";

const { UserError } = require("./errors.js");
const { stamp } = require("./prompt.js");

// Blank lines become one non-breaking space so sections stay visually separated.
const SPACER = "\u00a0";

function sendLines(publicClient, chan, text) {
  const lines = text.split("\n").map((line) => line.trimEnd());
  lines
    .filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== ""))
    .map((line) => (line === "" ? SPACER : line))
    .filter((line, i, all) => line !== SPACER || i < all.length - 1)
    .forEach((line) => publicClient.sendMessage(line, chan));
}

function summaryHeader({
  channel,
  count,
  fromMs,
  toMs,
  truncated,
  capped,
  timeZone,
}) {
  const noun = count === 1 ? "line" : "lines";
  const cap = capped
    ? `; capped at ${Math.round((toMs - fromMs) / 3600000)}h, the maxWindowHours limit`
    : "";
  const trunc = truncated ? "; input too large, newest part only" : "";
  return `Summary of ${channel}, ${stamp(fromMs, timeZone)} to ${stamp(toMs, timeZone)} (${count} ${noun}${cap}${trunc}):`;
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
