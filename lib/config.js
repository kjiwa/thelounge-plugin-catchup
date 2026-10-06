"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { UserError } = require("./errors.js");

const PROVIDERS = ["bedrock", "anthropic"];
const DEFAULT_MAX_WINDOW_HOURS = 24;
const KNOWN_KEYS = ["provider", "model", "region", "maxWindowHours"];

function validateConfig(raw, env) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UserError("config.json must contain a JSON object");
  }
  if (!PROVIDERS.includes(raw.provider)) {
    throw new UserError(
      `config.json: "provider" must be one of ${PROVIDERS.join(", ")}`,
    );
  }
  if (typeof raw.model !== "string" || raw.model === "") {
    throw new UserError('config.json: "model" must be a non-empty string');
  }
  const maxWindowHours = raw.maxWindowHours ?? DEFAULT_MAX_WINDOW_HOURS;
  if (!Number.isFinite(maxWindowHours) || maxWindowHours <= 0) {
    throw new UserError(
      'config.json: "maxWindowHours" must be a positive number',
    );
  }
  const config = {
    provider: raw.provider,
    model: raw.model,
    maxWindowHours,
  };
  if (raw.provider === "bedrock") {
    config.region = raw.region || env.AWS_REGION;
    if (!config.region) {
      throw new UserError(
        'config.json: "region" is required for bedrock when AWS_REGION is unset',
      );
    }
  } else if (!env.ANTHROPIC_API_KEY) {
    throw new UserError("ANTHROPIC_API_KEY is not set in the environment");
  }
  const unknownKeys = Object.keys(raw).filter((k) => !KNOWN_KEYS.includes(k));
  return { config, unknownKeys };
}

function readConfig(dir) {
  const file = path.join(dir, "config.json");
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new UserError(`config.json not found in ${dir}`);
    }
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new UserError("config.json is not valid JSON");
  }
}

function loadConfig(dir, env) {
  return validateConfig(readConfig(dir), env);
}

module.exports = { validateConfig, loadConfig };
