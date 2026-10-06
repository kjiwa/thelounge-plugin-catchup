"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildPrompt, limitInput, gapsSection } = require("../../lib/prompt.js");

const MIN = 60000;

const T0 = new Date(2026, 0, 1, 12, 0).getTime();
const lines = [
  {
    time: T0,
    type: "message",
    nick: "bob",
    text: "first line",
    highlight: false,
  },
  {
    time: T0 + 60000,
    type: "action",
    nick: "carol",
    text: "waves",
    highlight: false,
  },
  {
    time: T0 + 61 * 60000 + 60000,
    type: "message",
    nick: "bob",
    text: "alice, ping",
    highlight: true,
  },
  {
    time: T0 + 200 * 60000,
    type: "topic",
    nick: "bob",
    text: "new topic",
    highlight: false,
  },
];

test("the prompt contains every line, the mention mark, and the gap marker", () => {
  const { prompt, system } = buildPrompt({
    lines,
    channel: "#fixture",
    nick: "alice",
  });
  for (const text of ["first line", "waves", "alice, ping", "new topic"]) {
    assert.ok(prompt.includes(text), text);
  }
  assert.match(prompt, /\* carol waves/);
  assert.match(prompt, /alice, ping \[MENTIONS YOU\]/);
  assert.match(prompt, /-- gap of 61 minutes --/);
  assert.match(prompt, /-- gap of 138 minutes --/);
  assert.doesNotMatch(prompt, /gap of 1 minutes/);
  assert.match(system, /Invent nothing/);
});

test("a focus nick is named in the prompt", () => {
  const { prompt } = buildPrompt({
    lines,
    channel: "#fixture",
    nick: "alice",
    focusNick: "bob",
  });
  assert.match(prompt, /Focus on what bob said/);
});

test("limitInput keeps the newest lines when over the cap", () => {
  const result = limitInput(lines, 80);
  assert.equal(result.truncated, true);
  assert.equal(result.lines.at(-1).text, "new topic");
  assert.ok(result.lines.length < lines.length);
});

test("limitInput truncates a single line larger than the cap", () => {
  const huge = [{ time: 1, type: "message", nick: "a", text: "x".repeat(500) }];
  const result = limitInput(huge, 100);
  assert.equal(result.lines.length, 1);
  assert.ok(result.lines[0].text.length < 100);
  assert.equal(result.truncated, true);
});

test("limitInput leaves small inputs alone", () => {
  const result = limitInput(lines);
  assert.equal(result.truncated, false);
  assert.equal(result.lines.length, lines.length);
});

test("gapsSection lists each gap over an hour with its times", () => {
  const text = gapsSection(lines);
  assert.match(
    text,
    /^GAPS\n- .* to .*, 61 minutes of silence\n- .*, 138 minutes of silence$/,
  );
});

test("gapsSection says None. when the log has no gap", () => {
  assert.equal(gapsSection(lines.slice(0, 2)), "GAPS\nNone.");
});

const UTC_NOON = Date.UTC(2026, 0, 1, 12, 0);
const utcLines = [{ ...lines[0], time: UTC_NOON }];

test("transcript lines are stamped in the configured zone", () => {
  const { prompt } = buildPrompt({
    lines: utcLines,
    channel: "#fixture",
    nick: "alice",
    timeZone: "America/Los_Angeles",
  });
  assert.match(prompt, /\[2026-01-01 04:00\] <bob> first line/);
});

test("gapsSection stamps gaps in the configured zone", () => {
  const gapped = [utcLines[0], { ...lines[2], time: UTC_NOON + 2 * 3600000 }];
  assert.match(
    gapsSection(gapped, "America/Los_Angeles"),
    /- 2026-01-01 04:00 to 2026-01-01 06:00, 120 minutes of silence/,
  );
});

test("gapsSection counts silence before the first and after the last line", () => {
  const one = [{ ...lines[0], time: T0 }];
  const text = gapsSection(one, undefined, {
    fromMs: T0 - 120 * MIN,
    toMs: T0 + 90 * MIN,
  });
  assert.match(
    text,
    /^GAPS\n- .*, 120 minutes of silence\n- .*, 90 minutes of silence$/,
  );
});

test("gapsSection lists the five longest gaps in time order", () => {
  const minutes = [70, 200, 80, 300, 90, 100, 400, 110];
  let t = T0;
  const spaced = [{ ...lines[0], time: t }];
  for (const m of minutes) {
    t += m * MIN;
    spaced.push({ ...lines[0], time: t });
  }
  const listed = gapsSection(spaced)
    .split("\n")
    .map((line) => /, (\d+) minutes/.exec(line)?.[1]);
  assert.deepEqual(listed.slice(1, 6), ["200", "300", "100", "400", "110"]);
  assert.match(gapsSection(spaced), /\n- 3 shorter gaps not listed$/);
});

test("the log marks gaps between lines but not at the window edges", () => {
  const { prompt } = buildPrompt({
    lines: [{ ...lines[0], time: T0 }],
    channel: "#fixture",
    nick: "alice",
  });
  assert.doesNotMatch(prompt, /-- gap/);
});

test("the system prompt requires a gist for every topic", () => {
  const { system } = buildPrompt({ lines, channel: "#c", nick: "a" });
  assert.match(system, /Every topic must have a gist line/);
  assert.match(system, /Open: a question nobody answered/);
  assert.match(system, /own topic/);
});
