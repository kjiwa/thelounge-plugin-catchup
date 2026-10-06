"use strict";

const { zonedParts, zonedTime } = require("./clock.js");
const { UserError } = require("./errors.js");

const HOUR_MS = 3600000;
const USAGE =
  "Usage: /summarize [since-last|24h|6h|today|since HH:MM|YYYY-MM-DD] [nick] (or /summarize help)";

const HELP_LINES = [
  "/summarize [window] [nick] summarizes this channel from your IRC log.",
  "since-last: since your last message (the default)",
  "24h, 6h, ...: that many hours back",
  "today: since midnight",
  "since HH:MM: since that time, yesterday if still ahead",
  "YYYY-MM-DD: that one calendar day",
  "nick: focus on what that person said; after a window, or alone",
  "A nick named help needs a window first, e.g. /summarize 24h help",
];

function helpText(timeZone) {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [USAGE, ...HELP_LINES, `Times use ${zone}.`].join("\n");
}

function startOfDay(parts, timeZone) {
  return zonedTime({ ...parts, h: 0, min: 0 }, timeZone);
}

function startOfToday(nowMs, timeZone) {
  return startOfDay(zonedParts(nowMs, timeZone), timeZone);
}

function sinceClock(nowMs, hhmm, timeZone) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm ?? "");
  if (!match) {
    throw new UserError(USAGE);
  }
  const today = zonedParts(nowMs, timeZone);
  const at = (d) =>
    zonedTime(
      { ...today, d, h: Number(match[1]), min: Number(match[2]) },
      timeZone,
    );
  return at(today.d) > nowMs ? at(today.d - 1) : at(today.d);
}

// Round-trips through the zone to reject dates like 2026-02-30.
function dayWindow(token, ctx) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    throw new UserError(USAGE);
  }
  const [y, m, d] = token.split("-").map(Number);
  const fromMs = startOfDay({ y, m, d }, ctx.timeZone);
  const parts = zonedParts(fromMs, ctx.timeZone);
  if (parts.y !== y || parts.m !== m || parts.d !== d || fromMs > ctx.nowMs) {
    throw new UserError(USAGE);
  }
  const nextMs = startOfDay({ y, m, d: d + 1 }, ctx.timeZone);
  return { fromMs, toMs: Math.min(nextMs, ctx.nowMs), used: 1 };
}

function sinceLast(nowMs, maxWindowHours, findLastOwnMs) {
  const floor = nowMs - maxWindowHours * HOUR_MS;
  return Math.max(floor, findLastOwnMs(floor) ?? floor);
}

// Returns the start, an explicit end for date windows, and how many tokens
// the spec consumed.
function parseStart(tokens, ctx) {
  const [head] = tokens;
  const hours = /^(\d+)h$/.exec(head ?? "");
  if (hours) {
    if (Number(hours[1]) === 0) {
      throw new UserError(USAGE);
    }
    return { fromMs: ctx.nowMs - Number(hours[1]) * HOUR_MS, used: 1 };
  }
  if (/^\d{4}-\d+-\d+$/.test(head ?? "")) {
    return dayWindow(head, ctx);
  }
  if (head === "today") {
    return { fromMs: startOfToday(ctx.nowMs, ctx.timeZone), used: 1 };
  }
  if (head === "since") {
    return {
      fromMs: sinceClock(ctx.nowMs, tokens[1], ctx.timeZone),
      used: 2,
    };
  }
  return {
    fromMs: sinceLast(ctx.nowMs, ctx.maxWindowHours, ctx.findLastOwnMs),
    used: head === "since-last" ? 1 : 0,
  };
}

// ctx: { nowMs, maxWindowHours, timeZone, findLastOwnMs(floorMs) -> ms | undefined }
function parseWindow(args, ctx) {
  const tokens = args.filter((t) => t !== "");
  const { fromMs, toMs, used } = parseStart(tokens, ctx);
  const rest = tokens.slice(used);
  if (rest.length > 1) {
    throw new UserError(USAGE);
  }
  if (toMs !== undefined) {
    return { fromMs, toMs, nick: rest[0] };
  }
  const floor = ctx.nowMs - ctx.maxWindowHours * HOUR_MS;
  return { fromMs: Math.max(fromMs, floor), toMs: ctx.nowMs, nick: rest[0] };
}

module.exports = { parseWindow, helpText };
