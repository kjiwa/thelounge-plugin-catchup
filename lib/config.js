"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { UserError } = require("./errors.js");
const { MAX_INPUT_CHARS } = require("./prompt.js");

const PROVIDERS = ["bedrock", "anthropic", "openai-compatible", "lambda"];
const DEFAULT_MAX_WINDOW_HOURS = 24;
const DEFAULT_TIMEOUT_SECONDS = 60;
const KNOWN_KEYS = [
  "provider",
  "model",
  "function",
  "region",
  "baseURL",
  "maxInputChars",
  "timeoutSeconds",
  "maxWindowHours",
  "timeZone",
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

function baseURLSetting(raw) {
  const baseURL = requireString(raw, "baseURL", " for openai-compatible");
  let protocol;
  try {
    ({ protocol } = new URL(baseURL));
  } catch {
    protocol = undefined;
  }
  if (protocol !== "http:" && protocol !== "https:") {
    throw new UserError('config.json: "baseURL" must be an http or https URL');
  }
  return baseURL;
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
  if (raw.provider === "openai-compatible") {
    return { model, baseURL: baseURLSetting(raw) };
  }
  if (!env.ANTHROPIC_API_KEY) {
    throw new UserError("ANTHROPIC_API_KEY is not set in the environment");
  }
  return { model };
}

function timeZoneSetting(raw) {
  if (raw.timeZone === undefined) {
    return {};
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw.timeZone });
  } catch {
    throw new UserError(
      'config.json: "timeZone" must be an IANA time zone name',
    );
  }
  return { timeZone: raw.timeZone };
}

function positiveSetting(raw, key, fallback, integer) {
  const value = raw[key] ?? fallback;
  if (!Number.isFinite(value) || value <= 0 || (integer && value % 1 !== 0)) {
    throw new UserError(
      `config.json: "${key}" must be a positive ${integer ? "integer" : "number"}`,
    );
  }
  return value;
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
  const config = {
    provider: raw.provider,
    ...providerSettings(raw, env),
    maxWindowHours: positiveSetting(
      raw,
      "maxWindowHours",
      DEFAULT_MAX_WINDOW_HOURS,
    ),
    maxInputChars: positiveSetting(raw, "maxInputChars", MAX_INPUT_CHARS, true),
    timeoutSeconds: positiveSetting(
      raw,
      "timeoutSeconds",
      DEFAULT_TIMEOUT_SECONDS,
    ),
    ...timeZoneSetting(raw),
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
