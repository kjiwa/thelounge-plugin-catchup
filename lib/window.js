"use strict";

const { zonedParts, zonedTime } = require("./clock.js");
const { UserError } = require("./errors.js");

const HOUR_MS = 3600000;
const USAGE =
  "Usage: /summarize [since-last|24h|6h|today|since HH:MM|YYYY-MM-DD] [nick] (or /summarize help)";
const ASK_USAGE =
  "Usage: /ask [24h|6h|today|since HH:MM|YYYY-MM-DD] <question> (or /ask help)";
const MAX_QUESTION_CHARS = 500;
const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

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

const ASK_HELP_LINES = [
  "/ask [window] <question> answers a question from this channel's IRC log.",
  "No window: the last maxWindowHours, not since your last message",
  "24h, 6h, ...: that many hours back",
  "today: since midnight",
  "since HH:MM: since that time, yesterday if still ahead",
  "YYYY-MM-DD: that one calendar day",
  "The question is everything after the window, up to 500 characters",
];

function helpText(timeZone, command = "summarize") {
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [usage, lines] =
    command === "ask" ? [ASK_USAGE, ASK_HELP_LINES] : [USAGE, HELP_LINES];
  return [usage, ...lines, `Times use ${zone}.`].join("\n");
}

function startOfDay(parts, timeZone) {
  return zonedTime({ ...parts, h: 0, min: 0 }, timeZone);
}

function startOfToday(nowMs, timeZone) {
  return startOfDay(zonedParts(nowMs, timeZone), timeZone);
}

function sinceClock(nowMs, hhmm, timeZone, usage) {
  const match = CLOCK.exec(hhmm ?? "");
  if (!match) {
    throw new UserError(usage);
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
function dayWindow(token, ctx, usage) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    throw new UserError(usage);
  }
  const [y, m, d] = token.split("-").map(Number);
  const fromMs = startOfDay({ y, m, d }, ctx.timeZone);
  const parts = zonedParts(fromMs, ctx.timeZone);
  if (parts.y !== y || parts.m !== m || parts.d !== d || fromMs > ctx.nowMs) {
    throw new UserError(usage);
  }
  const nextMs = startOfDay({ y, m, d: d + 1 }, ctx.timeZone);
  return { fromMs, toMs: Math.min(nextMs, ctx.nowMs), used: 1 };
}

function sinceLast(nowMs, maxWindowHours, findLastOwnMs) {
  const floor = nowMs - maxWindowHours * HOUR_MS;
  return Math.max(floor, findLastOwnMs(floor) ?? floor);
}

// Returns undefined when the tokens do not open with a window. Otherwise the
// start, an explicit end for date windows, and how many tokens the spec used.
function parseExplicitStart(tokens, ctx, usage) {
  const [head] = tokens;
  const hours = /^(\d+)h$/.exec(head ?? "");
  if (hours) {
    if (Number(hours[1]) === 0) {
      throw new UserError(usage);
    }
    return { fromMs: ctx.nowMs - Number(hours[1]) * HOUR_MS, used: 1 };
  }
  if (/^\d{4}-\d+-\d+$/.test(head ?? "")) {
    return dayWindow(head, ctx, usage);
  }
  if (head === "today") {
    return { fromMs: startOfToday(ctx.nowMs, ctx.timeZone), used: 1 };
  }
  if (head === "since") {
    return {
      fromMs: sinceClock(ctx.nowMs, tokens[1], ctx.timeZone, usage),
      used: 2,
    };
  }
  return undefined;
}

function parseStart(tokens, ctx) {
  return (
    parseExplicitStart(tokens, ctx, USAGE) ?? {
      fromMs: sinceLast(ctx.nowMs, ctx.maxWindowHours, ctx.findLastOwnMs),
      used: tokens[0] === "since-last" ? 1 : 0,
    }
  );
}

function parseAskStart(tokens, ctx) {
  const isWindow = tokens[0] !== "since" || CLOCK.test(tokens[1] ?? "");
  return (
    (isWindow ? parseExplicitStart(tokens, ctx, ASK_USAGE) : undefined) ?? {
      fromMs: ctx.nowMs - ctx.maxWindowHours * HOUR_MS,
      used: 0,
    }
  );
}

// Explicit date windows keep their own end; the rest end now and are raised
// to the maxWindowHours floor.
function bound({ fromMs, toMs }, ctx) {
  if (toMs !== undefined) {
    return { fromMs, toMs };
  }
  const floor = ctx.nowMs - ctx.maxWindowHours * HOUR_MS;
  return {
    fromMs: Math.max(fromMs, floor),
    toMs: ctx.nowMs,
    capped: fromMs < floor,
  };
}

// ctx: { nowMs, maxWindowHours, timeZone, findLastOwnMs(floorMs) -> ms | undefined }
function parseWindow(args, ctx) {
  const tokens = args.filter((t) => t !== "");
  const start = parseStart(tokens, ctx);
  const rest = tokens.slice(start.used);
  if (rest.length > 1) {
    throw new UserError(USAGE);
  }
  return { ...bound(start, ctx), nick: rest[0] };
}

function parseAskWindow(args, ctx) {
  const tokens = args.filter((t) => t !== "");
  const start = parseAskStart(tokens, ctx);
  const question = tokens.slice(start.used).join(" ");
  if (question === "" || question.length > MAX_QUESTION_CHARS) {
    throw new UserError(ASK_USAGE);
  }
  return { ...bound(start, ctx), question };
}

module.exports = { parseWindow, parseAskWindow, helpText };
