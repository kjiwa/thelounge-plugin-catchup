# Changelog

## 0.4.1

MENTIONS is built by the plugin, not the model: highlighted lines by others, newest 10 in time order, then `N more not listed`; your own lines are never listed. Count nouns agree in number (`1 shorter gap not listed`). Model lines reading `Open: none` are dropped.

## 0.4.0

The header notes when `maxWindowHours` capped an `Nh` window and says `1 line` in the singular. GAPS counts silence at the window edges, lists the 5 longest gaps, and reports the rest as `N shorter gaps not listed`; a truncated input omits the window-start gap. The prompt requires a gist for every topic and a separate topic per subject.

## 0.3.0

Adds `/summarize YYYY-MM-DD` for one calendar day (not capped by `maxWindowHours`), `/summarize help`, and an optional `timeZone` config key that sets day boundaries and every printed timestamp. Without it the server zone applies, as before.

## 0.2.0

Summaries use a fixed plain-text layout, and silence gaps are listed by the plugin rather than the model. Adds the `lambda` provider: `/summarize` invokes a gateway Lambda function (`function`, `region`) over the dual-stack endpoint instead of calling a model directly.

## 0.1.0

Adds `/summarize [since-last|Nh|today|since HH:MM] [nick]`, summarizing the channel log of the requesting user with the configured `bedrock` or `anthropic` provider. The prompt wording is provisional.
