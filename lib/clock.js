"use strict";

const formatters = new Map();

function formatterFor(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      }),
    );
  }
  return formatters.get(timeZone);
}

// A timeZone of undefined means the server zone.
function zonedParts(ms, timeZone) {
  const fields = formatterFor(timeZone).formatToParts(ms);
  const value = (type) => Number(fields.find((f) => f.type === type).value);
  return {
    y: value("year"),
    m: value("month"),
    d: value("day"),
    h: value("hour"),
    min: value("minute"),
  };
}

function offsetMs(ms, timeZone) {
  const { y, m, d, h, min } = zonedParts(ms, timeZone);
  return Date.UTC(y, m - 1, d, h, min) - Math.floor(ms / 60000) * 60000;
}

// Out-of-range fields roll over like Date.UTC, so d + 1 is the next day.
function zonedTime({ y, m, d, h = 0, min = 0 }, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(first, timeZone);
}

module.exports = { zonedParts, zonedTime };
