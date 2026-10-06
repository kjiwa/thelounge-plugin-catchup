"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { UserError } = require("./errors.js");

const PROVIDERS = ["bedrock", "anthropic", "lambda"];
const DEFAULT_MAX_WINDOW_HOURS = 24;
const KNOWN_KEYS = [
  "provider",
  "model",
  "function",
  "region",
  "maxWindowHours",
];

function requireString(raw, key, suffix = "") {
  if (typeof raw[key] !== "string" || raw[key] === "") {
    throw new UserError(
      `config.json: "${key}" must be a non-empty string${suffix}`,
    );
  }
  return raw[key];
}

function awsRegion(raw, env) {
  const region = raw.region || env.AWS_REGION;
  if (!region) {
    throw new UserError(
      `config.json: "region" is required for ${raw.provider} when AWS_REGION is unset`,
    );
  }
  return region;
}

function providerSettings(raw, env) {
  if (raw.provider === "lambda") {
    return {
      function: requireString(raw, "function", " for lambda"),
      region: awsRegion(raw, env),
    };
  }
  const model = requireString(raw, "model");
  if (raw.provider === "bedrock") {
    return { model, region: awsRegion(raw, env) };
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new UserError("ANTHROPIC_API_KEY is not set in the environment");
  }
  return { model };
}

function validateConfig(raw, env) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new UserError("config.json must contain a JSON object");
  }
  if (!PROVIDERS.includes(raw.provider)) {
    throw new UserError(
      `config.json: "provider" must be one of ${PROVIDERS.join(", ")}`,
    );
  }
  const maxWindowHours = raw.maxWindowHours ?? DEFAULT_MAX_WINDOW_HOURS;
  if (!Number.isFinite(maxWindowHours) || maxWindowHours <= 0) {
    throw new UserError(
      'config.json: "maxWindowHours" must be a positive number',
    );
  }
  const config = {
    provider: raw.provider,
    ...providerSettings(raw, env),
    maxWindowHours,
  };
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
