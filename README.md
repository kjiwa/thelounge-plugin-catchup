# thelounge-plugin-catchup

Summarizes what you missed in IRC channels on The Lounge, on demand and only in your own client, using the LLM you configure.

## Install

```sh
thelounge install thelounge-plugin-catchup
```

## Quick start

1. Create `config.json` in `THELOUNGE_HOME/packages/thelounge-plugin-catchup/`:

   ```json
   {
     "provider": "anthropic",
     "model": "claude-sonnet-5-5"
   }
   ```

2. Set the credentials for your provider in the environment of The Lounge process (see [Providers](#providers)). This example needs `ANTHROPIC_API_KEY`.
3. Restart The Lounge, then in any channel:

   ```
   /summarize
   /summarize 6h
   /summarize today bob
   /ask 6h who agreed to review the deploy?
   ```

## Usage

### Windows

Both commands take an optional window.

| Window        | Range                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `since-last`  | From your own last message in the channel (default), at most `maxWindowHours`. |
| `24h`, `6h`   | The last N hours (any `Nh`).                                                   |
| `today`       | Since midnight.                                                                |
| `since HH:MM` | Since that time today, or yesterday if it is still ahead.                      |
| `YYYY-MM-DD`  | That one calendar day (up to now for today). Not limited by `maxWindowHours`.  |

`today`, `since HH:MM` and days use the `timeZone` config key, or the time zone of the server running The Lounge when it is unset. Printed timestamps use the same zone. When `maxWindowHours` shortens an explicit `Nh` window, the header says so.

### /summarize

`/summarize [window] [nick]`

Summarizes the window. A nick asks the model to focus on what that person said. `/summarize help` prints the usage and the installed plugin version. A nick named `help` needs a window first, as in `/summarize 24h help`.

### /ask

`/ask [window] <question>`

Answers a question of up to 500 characters from the window's log alone, citing nick and time, and says so when the log lacks the fact. It also follows instructions about the log, such as quoting messages or summarizing each person in a line. `/ask help` prints the usage and the plugin version.

With no window it covers the last `maxWindowHours` rather than since-last. `since` counts as a window only before an `HH:MM`, so `/ask since when did bob leave?` is a question. A question that starts with a window word (`today`, `6h`, a date) needs a window in front, as in `/ask 24h today is the deploy done?`.

### Reply layout

Only you see the reply.

```
Summary of #deploys, 2026-10-07 09:00 to 2026-10-07 17:00 (42 lines):
OVERVIEW
...
TOPICS
1. Short title (nick, nick)
   Gist in two to four sentences.
POSITIONS
- nick: their position

MENTIONS
- 09:41 bob: alice, can you review the deploy?

GAPS
- 2026-10-07 11:00 to 2026-10-07 13:10, 130 minutes of silence
```

The model writes OVERVIEW, TOPICS and POSITIONS; every topic carries a gist. The plugin builds the header, MENTIONS and GAPS. `/ask` replies are the header and the answer only.

- MENTIONS lists lines The Lounge highlighted for you, by other people, as `- HH:MM nick: text` (text cut to 100 characters): the newest 10 in time order, then `N more not listed`; `None.` when empty.
- GAPS lists silence over 60 minutes, including the stretch from the window start to the first line and from the last line to the window end: the 5 longest in time order, then `N shorter gaps not listed` (`1 shorter gap` in the singular).
- If the window holds more than `maxInputChars` characters, only the newest part is sent, the header says so, and the window-start gap is omitted.
- A reply that hits the model's output limit ends with `(Reply cut at the output limit.)`.

## Configuration

`config.json` in the plugin's persistent storage directory (`THELOUNGE_HOME/packages/thelounge-plugin-catchup/`), read at server start. Changes need a restart.

| Key              | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `provider`       | Required. `bedrock`, `anthropic`, `openai-compatible` or `lambda`.                          |
| `model`          | Required for all but `lambda`: model, inference profile or server model name.               |
| `function`       | Required for `lambda`. Function name or ARN.                                                |
| `region`         | `bedrock` and `lambda`. Falls back to `AWS_REGION`.                                         |
| `baseURL`        | Required for `openai-compatible`. An `http` or `https` URL, e.g. ending in `/v1`.           |
| `maxInputChars`  | Optional, default 200000. Longest log sent to any provider; the newest part is kept.        |
| `timeoutSeconds` | Optional, default 60. Timeout of the model call for any provider.                           |
| `maxWindowHours` | Optional, default 24. Cap for every relative window, `Nh` included, and the `/ask` default. |
| `timeZone`       | Optional IANA name, e.g. `America/Los_Angeles`. Default: server zone.                       |

Unknown keys are ignored with a warning in the server log. A config error is logged at start and shown as the reply to every command. Credentials come from the environment, never from `config.json`.

## Providers

### Bedrock

The plugin passes the AI SDK a model object built from the AWS SDK default credential chain, so any source that chain supports works.

- On AWS (EC2, ECS, EKS): attach a role with `bedrock:InvokeModel`. Nothing else is needed.
- Off AWS, short-term credentials: IAM Roles Anywhere. Its credential helper runs as `credential_process` or `serve` and returns sessions that refresh themselves. It needs your own CA and a certificate.
- Off AWS, simplest: a long-term Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK`. AWS calls long-term keys exploration-only. Short-term keys expire within 12 hours and cannot be refreshed through an environment variable.

When `AWS_BEARER_TOKEN_BEDROCK` is set it takes precedence over the credential chain.

### Anthropic

Set `ANTHROPIC_API_KEY` in the environment of The Lounge process. The plugin refuses to start the provider without it.

### OpenAI-compatible

Any server that speaks the OpenAI chat completions API. Set `OPENAI_COMPATIBLE_API_KEY` in the environment of The Lounge process if the server needs a key; it is optional.

Ollama:

```json
{
  "provider": "openai-compatible",
  "baseURL": "http://127.0.0.1:11434/v1",
  "model": "llama3.2:3b",
  "maxInputChars": 6000,
  "timeoutSeconds": 180
}
```

llama.cpp `llama-server`:

```json
{
  "provider": "openai-compatible",
  "baseURL": "http://127.0.0.1:8080/v1",
  "model": "local"
}
```

OpenRouter, with the key in `OPENAI_COMPATIBLE_API_KEY`:

```json
{
  "provider": "openai-compatible",
  "baseURL": "https://openrouter.ai/api/v1",
  "model": "anthropic/claude-sonnet-5.5"
}
```

Size `maxInputChars` to the model's context: the prompt, the log and a reply of up to 1500 tokens must fit, at about 3-4 characters per token. Ollama's `/v1` API cannot set the context, which defaults to 4k, 32k or 256k tokens by available VRAM; set `OLLAMA_CONTEXT_LENGTH` on the Ollama server to raise it. Small models on slow hardware also need a higher `timeoutSeconds`, and summaries from models around 1.5B parameters are poor.

### Lambda

The plugin invokes your gateway function with `{"system": "...", "prompt": "..."}` and expects `{"text": "..."}` back, plus `"cut": true` when the model hit its output limit. The function holds the model choice and the Bedrock permissions, so The Lounge host needs only `lambda:InvokeFunction` on that function. Credentials come from the same AWS SDK default chain as Bedrock.

The client uses the dual-stack endpoint (`lambda.<region>.api.aws`), so an IPv6-only host works. Setting `AWS_ENDPOINT_URL_LAMBDA` or `AWS_ENDPOINT_URL` replaces it, because the SDK rejects dual-stack with a custom endpoint. A function error is logged to the server log and never shown in the channel. The AI SDK is not loaded for this provider.

## Requirements and limitations

- Node.js 22.17 or newer.
- The Lounge 4.5.2 or newer in the 4.x line.
- Message logging to sqlite (`messageStorage: ["sqlite"]` and a user with logs enabled). Text-only logging is not read, and since the plugin API has no hook for incoming messages, the plugin reads the sqlite log on demand.
- Lobby and server-window messages are never logged by The Lounge and cannot be summarized.
- Loading the AI SDK adds about 35 MB RSS on first use (measured on Node 24). Loading the Lambda client adds about 28 MB (same measurement).
- Bedrock is not reachable over IPv6 in the regions checked; an IPv6-only host needs the `lambda` provider, the `anthropic` provider or IPv4 egress. `openai-compatible` depends on the server.

## Scope

On-demand catch-up in the requesting user's own client. Output reaches only the user who ran the command. The plugin stores nothing and builds no per-person profiles. See [SECURITY.md](SECURITY.md) for what it reads and sends.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
