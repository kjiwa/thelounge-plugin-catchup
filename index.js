"use strict";

const path = require("node:path");

const { loadConfig } = require("./lib/config.js");
const { UserError } = require("./lib/errors.js");
const { sendLines, sendError, summaryHeader } = require("./lib/format.js");
const { generate } = require("./lib/generate.js");
const { invokeGateway } = require("./lib/gateway.js");
const { createModel } = require("./lib/model.js");
const { buildPrompt, gapsSection, limitInput } = require("./lib/prompt.js");
const { openLog, fetchLines, findLastOwnMs } = require("./lib/store.js");
const { parseWindow, helpText } = require("./lib/window.js");

// client.name is TheLounge's internal user name and the only way to reach the
// per-user log file; the public client API does not expose it.
function userLogName(publicClient) {
  const name = publicClient.client?.name;
  if (typeof name !== "string" || name === "") {
    throw new UserError("Cannot determine your user name to locate the log");
  }
  return name;
}

function loadLines(db, { network, chan, args, config }) {
  const query = { networkUuid: network.uuid, channel: chan.name };
  const window = parseWindow(args, {
    nowMs: Date.now(),
    maxWindowHours: config.maxWindowHours,
    timeZone: config.timeZone,
    findLastOwnMs: (floorMs) =>
      findLastOwnMs(
        db,
        { ...query, fromMs: floorMs, toMs: Date.now() },
        network.nick,
      ),
  });
  const lines = fetchLines(db, { ...query, ...window });
  return { window, lines };
}

// The lambda provider bypasses the AI SDK so it is never loaded on that path.
async function complete(config, request) {
  if (config.provider === "lambda") {
    return invokeGateway(config, request);
  }
  return generate(await createModel(config), request);
}

async function summarize(deps, publicClient, target, args) {
  const { network, chan } = target;
  if (args[0] === "help") {
    sendLines(publicClient, chan, helpText(deps.config?.timeZone));
    return;
  }
  if (deps.configError) {
    throw deps.configError;
  }
  const db = openLog(deps.home, userLogName(publicClient));
  let loaded;
  try {
    loaded = loadLines(db, { network, chan, args, config: deps.config });
  } finally {
    db.close();
  }
  if (loaded.lines.length === 0) {
    sendLines(publicClient, chan, "No messages in that window.");
    return;
  }
  const limited = limitInput(loaded.lines);
  const text = await complete(
    deps.config,
    buildPrompt({
      lines: limited.lines,
      channel: chan.name,
      nick: network.nick,
      focusNick: loaded.window.nick,
      timeZone: deps.config.timeZone,
    }),
  );
  const header = summaryHeader({
    channel: chan.name,
    count: limited.lines.length,
    fromMs: loaded.window.fromMs,
    toMs: loaded.window.toMs,
    truncated: limited.truncated,
    capped: loaded.window.capped,
    timeZone: deps.config.timeZone,
  });
  const gapBounds = {
    fromMs: limited.truncated ? undefined : loaded.window.fromMs,
    toMs: loaded.window.toMs,
  };
  sendLines(
    publicClient,
    chan,
    `${header}\n${text}\n\n${gapsSection(limited.lines, deps.config.timeZone, gapBounds)}`,
  );
}

function readSettings(api) {
  const dir = api.Config.getPersistentStorageDir();
  const home = path.dirname(path.dirname(dir));
  try {
    const { config, unknownKeys } = loadConfig(dir, process.env);
    unknownKeys.forEach((key) =>
      api.Logger.warn(`Unknown config key "${key}" ignored`),
    );
    return { home, config };
  } catch (err) {
    if (!(err instanceof UserError)) {
      throw err;
    }
    api.Logger.error(err.message);
    return { home, configError: err };
  }
}

module.exports = {
  onServerStart(api) {
    const deps = readSettings(api);
    api.Commands.add("summarize", {
      allowDisconnected: true,
      input(publicClient, target, _command, args) {
        summarize(deps, publicClient, target, args).catch((err) => {
          try {
            sendError(publicClient, target.chan, err, api.Logger);
          } catch (sendErr) {
            api.Logger.error(`Could not report error: ${sendErr.message}`);
          }
        });
      },
    });
  },
};
