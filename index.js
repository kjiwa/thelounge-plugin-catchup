"use strict";

const path = require("node:path");

const { loadConfig } = require("./lib/config.js");
const { UserError } = require("./lib/errors.js");
const { sendLines, sendError, summaryHeader } = require("./lib/format.js");
const { generate } = require("./lib/generate.js");
const { invokeGateway } = require("./lib/gateway.js");
const { createModel } = require("./lib/model.js");
const {
  buildAskPrompt,
  buildPrompt,
  gapsSection,
  limitInput,
  mentionsSection,
} = require("./lib/prompt.js");
const { openLog, fetchLines, findLastOwnMs } = require("./lib/store.js");
const { parseWindow, parseAskWindow, helpText } = require("./lib/window.js");

const { version } = require("./package.json");

// client.name is TheLounge's internal user name and the only way to reach the
// per-user log file; the public client API does not expose it.
function userLogName(publicClient) {
  const name = publicClient.client?.name;
  if (typeof name !== "string" || name === "") {
    throw new UserError("Cannot determine your user name to locate the log");
  }
  return name;
}

function loadLines(db, { network, chan, spec, config }) {
  const query = { networkUuid: network.uuid, channel: chan.name };
  const window = spec.parse(spec.args, {
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

const CUT_NOTICE = "(Reply cut at the output limit.)";

// The lambda provider bypasses the AI SDK so it is never loaded on that path.
async function complete(config, request) {
  if (config.provider === "lambda") {
    return invokeGateway(config, request);
  }
  return generate(await createModel(config), request);
}

async function loadAndComplete(deps, publicClient, target, spec) {
  const { network, chan } = target;
  if (deps.configError) {
    throw deps.configError;
  }
  const db = openLog(deps.home, userLogName(publicClient));
  let loaded;
  try {
    loaded = loadLines(db, { network, chan, spec, config: deps.config });
  } finally {
    db.close();
  }
  if (loaded.lines.length === 0) {
    sendLines(publicClient, chan, "No messages in that window.");
    return undefined;
  }
  const limited = limitInput(loaded.lines);
  const { text, cut } = await complete(
    deps.config,
    spec.buildRequest({
      lines: limited.lines,
      channel: chan.name,
      nick: network.nick,
      window: loaded.window,
      timeZone: deps.config.timeZone,
    }),
  );
  return {
    window: loaded.window,
    limited,
    text: cut ? `${text}\n${CUT_NOTICE}` : text,
  };
}

function headerFor(title, deps, chan, { window, limited }) {
  return summaryHeader({
    title,
    channel: chan.name,
    count: limited.lines.length,
    fromMs: window.fromMs,
    toMs: window.toMs,
    truncated: limited.truncated,
    capped: window.capped,
    timeZone: deps.config.timeZone,
  });
}

async function summarize(deps, publicClient, target, args) {
  const { network, chan } = target;
  if (args[0] === "help") {
    sendLines(
      publicClient,
      chan,
      helpText(deps.config?.timeZone, "summarize", version),
    );
    return;
  }
  const result = await loadAndComplete(deps, publicClient, target, {
    args,
    parse: parseWindow,
    buildRequest: ({ lines, channel, nick, window, timeZone }) =>
      buildPrompt({ lines, channel, nick, focusNick: window.nick, timeZone }),
  });
  if (!result) {
    return;
  }
  const { window, limited, text } = result;
  const gapBounds = {
    fromMs: limited.truncated ? undefined : window.fromMs,
    toMs: window.toMs,
  };
  sendLines(
    publicClient,
    chan,
    `${headerFor("Summary of", deps, chan, result)}\n${text}\n\n${mentionsSection(limited.lines, deps.config.timeZone, network.nick)}\n\n${gapsSection(limited.lines, deps.config.timeZone, gapBounds)}`,
  );
}

function isHelpRequest(args) {
  const tokens = args.filter((token) => token !== "");
  return tokens.length === 1 && tokens[0] === "help";
}

async function ask(deps, publicClient, target, args) {
  const { chan } = target;
  if (isHelpRequest(args)) {
    sendLines(
      publicClient,
      chan,
      helpText(deps.config?.timeZone, "ask", version),
    );
    return;
  }
  const result = await loadAndComplete(deps, publicClient, target, {
    args,
    parse: parseAskWindow,
    buildRequest: ({ lines, channel, nick, window, timeZone }) =>
      buildAskPrompt({
        lines,
        channel,
        nick,
        question: window.question,
        timeZone,
      }),
  });
  if (result) {
    sendLines(
      publicClient,
      chan,
      `${headerFor("Answer from", deps, chan, result)}\n${result.text}`,
    );
  }
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

function addCommand(api, name, run, deps) {
  api.Commands.add(name, {
    allowDisconnected: true,
    input(publicClient, target, _command, args) {
      run(deps, publicClient, target, args).catch((err) => {
        try {
          sendError(publicClient, target.chan, err, api.Logger);
        } catch (sendErr) {
          api.Logger.error(`Could not report error: ${sendErr.message}`);
        }
      });
    },
  });
}

module.exports = {
  onServerStart(api) {
    const deps = readSettings(api);
    addCommand(api, "summarize", summarize, deps);
    addCommand(api, "ask", ask, deps);
  },
};
