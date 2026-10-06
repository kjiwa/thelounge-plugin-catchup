"use strict";

const { UserError } = require("./errors.js");

const HOUR_MS = 3600000;
const USAGE = "Usage: /summarize [since-last|24h|6h|today|since HH:MM] [nick]";

function startOfToday(nowMs) {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sinceClock(nowMs, hhmm) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? "");
  if (!match) {
    throw new UserError(USAGE);
  }
  const d = new Date(nowMs);
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d.getTime() > nowMs ? d.setDate(d.getDate() - 1) : d.getTime();
}

function sinceLast(nowMs, maxWindowHours, findLastOwnMs) {
  const floor = nowMs - maxWindowHours * HOUR_MS;
  return Math.max(floor, findLastOwnMs(floor) ?? floor);
}

// Returns the start time and how many tokens the spec consumed.
function parseStart(tokens, ctx) {
  const [head] = tokens;
  const hours = /^(\d+)h$/.exec(head ?? "");
  if (hours) {
    if (Number(hours[1]) === 0) {
      throw new UserError(USAGE);
    }
    return { fromMs: ctx.nowMs - Number(hours[1]) * HOUR_MS, used: 1 };
  }
  if (head === "today") {
    return { fromMs: startOfToday(ctx.nowMs), used: 1 };
  }
  if (head === "since") {
    return { fromMs: sinceClock(ctx.nowMs, tokens[1]), used: 2 };
  }
  return {
    fromMs: sinceLast(ctx.nowMs, ctx.maxWindowHours, ctx.findLastOwnMs),
    used: head === "since-last" ? 1 : 0,
  };
}

// ctx: { nowMs, maxWindowHours, findLastOwnMs(floorMs) -> ms | undefined }
function parseWindow(args, ctx) {
  const tokens = args.filter((t) => t !== "");
  const { fromMs, used } = parseStart(tokens, ctx);
  const rest = tokens.slice(used);
  if (rest.length > 1) {
    throw new UserError(USAGE);
  }
  const floor = ctx.nowMs - ctx.maxWindowHours * HOUR_MS;
  return { fromMs: Math.max(fromMs, floor), toMs: ctx.nowMs, nick: rest[0] };
}

module.exports = { parseWindow };
