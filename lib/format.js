"use strict";

const { UserError } = require("./errors.js");
const { plural, stamp } = require("./prompt.js");

// Blank lines become one non-breaking space so sections stay visually separated.
const SPACER = "\u00a0";

const EMPTY_OPEN = /^\s*Open:\s*none\.?\s*$/i;

function sendLines(publicClient, chan, text) {
  const lines = text
    .split("\n")
    .filter((line) => !EMPTY_OPEN.test(line))
    .map((line) => line.trimEnd());
  lines
    .filter((line, i) => line !== "" || (i > 0 && lines[i - 1] !== ""))
    .map((line) => (line === "" ? SPACER : line))
    .filter((line, i, all) => line !== SPACER || i < all.length - 1)
    .forEach((line) => publicClient.sendMessage(line, chan));
}

function summaryHeader({
  title = "Summary of",
  channel,
  count,
  fromMs,
  toMs,
  truncated,
  capped,
  timeZone,
}) {
  const cap = capped
    ? `; capped at ${Math.round((toMs - fromMs) / 3600000)}h, the maxWindowHours limit`
    : "";
  const trunc = truncated ? "; input too large, newest part only" : "";
  return `${title} ${channel}, ${stamp(fromMs, timeZone)} to ${stamp(toMs, timeZone)} (${plural(count, "line")}${cap}${trunc}):`;
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
    "Request failed; see the server log for details.",
    chan,
  );
}

module.exports = { sendLines, sendError, summaryHeader };
