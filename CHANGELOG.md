# Changelog

## 0.5.4

`/ask` no longer answers "the log does not say" to instructions such as quoting messages or when the fact is in the log, and summarizes each person in one line when asked what everyone said. Prompt change only.

## 0.5.3

Replies show `catchup` as the sender instead of the package name, via `thelounge.name` in package.json. Help is four rows per command, since The Lounge renders every plugin line as its own prefixed row and does not preserve newlines inside one.

## 0.5.2

`/summarize help` and `/ask help` end with the installed plugin version, since TheLounge has no in-client plugin list.

## 0.5.1

A reply that hits the model's output limit ends with `(Reply cut at the output limit.)` instead of reading as complete. The gateway Lambda reports this as `cut`; replies from an older gateway never show the notice.

## 0.5.0

Adds `/ask [window] <question>` and `/ask help`: the model answers from the window's log only, citing nick and time. Without a window it covers the last `maxWindowHours`, and `since` is a window only before `HH:MM`. The reply has a header and the answer, without MENTIONS or GAPS.

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
