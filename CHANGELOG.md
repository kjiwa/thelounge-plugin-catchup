# Changelog

## Unreleased

Adds `/summarize YYYY-MM-DD` for one calendar day (not capped by `maxWindowHours`), `/summarize help`, and an optional `timeZone` config key that sets day boundaries and every printed timestamp. Without it the server zone applies, as before.

## 0.2.0

Summaries use a fixed plain-text layout, and silence gaps are listed by the plugin rather than the model. Adds the `lambda` provider: `/summarize` invokes a gateway Lambda function (`function`, `region`) over the dual-stack endpoint instead of calling a model directly.

## 0.1.0

Adds `/summarize [since-last|Nh|today|since HH:MM] [nick]`, summarizing the channel log of the requesting user with the configured `bedrock` or `anthropic` provider. The prompt wording is provisional.
