# thelounge-plugin-catchup

Summarizes what you missed in IRC channels on The Lounge, on demand and only in your own client, using the LLM you configure.

## Install

```sh
thelounge install thelounge-plugin-catchup
```

## Quick start

Create `packages/thelounge-plugin-catchup/config.json` under `THELOUNGE_HOME`, give The Lounge process credentials for your provider (see Credentials), restart, then in any channel:

```
/summarize
/summarize 6h
/summarize today bob
```

## Usage

`/summarize [window] [nick]`

| Window        | Range                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `since-last`  | From your own last message in the channel (default), at most `maxWindowHours`. |
| `24h`, `6h`   | The last N hours (any `Nh`).                                                   |
| `today`       | Since midnight.                                                                |
| `since HH:MM` | Since that time today, or yesterday if it is still ahead.                      |
| `YYYY-MM-DD`  | That one calendar day (up to now for today). Not limited by `maxWindowHours`.  |

`/summarize help` prints the usage. A nick named `help` needs a window first, as in `/summarize 24h help`.

Days, `today` and `since HH:MM` use the `timeZone` config key, or the time zone of the server running The Lounge when it is unset. Printed timestamps use the same zone. A nick asks the model to focus on what that person said. If the window holds more than 200,000 characters the newest part is summarized and the reply says so. The header notes when `maxWindowHours` shortened an explicit `Nh` window. Every topic carries a gist.

MENTIONS is built by the plugin between the summary and GAPS. It lists lines TheLounge highlighted for you, by other people, as `- HH:MM nick: text` (text cut to 100 characters), the newest 10 in time order, then `N more not listed`; `None.` when empty.

Silence over 60 minutes is listed under GAPS, including the stretch from the window start to the first line and from the last line to the window end. GAPS shows the 5 longest in time order, then a `N shorter gaps not listed` line (`1 shorter gap` in the singular). When the input was truncated the window-start gap is omitted.

## Configuration

`config.json` in the plugin's persistent storage directory (`THELOUNGE_HOME/packages/thelounge-plugin-catchup/`), read at server start:

| Key              | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `provider`       | Required. `bedrock`, `anthropic` or `lambda`.                          |
| `model`          | Required for `bedrock` and `anthropic`: model or inference profile ID. |
| `function`       | Required for `lambda`. Function name or ARN.                           |
| `region`         | `bedrock` and `lambda`. Falls back to `AWS_REGION`.                    |
| `maxWindowHours` | Optional, default 24. Cap for every relative window, `Nh` included.    |
| `timeZone`       | Optional IANA name, e.g. `America/Los_Angeles`. Default: server zone.  |

Unknown keys are ignored with a warning in the server log. Never put a key in `config.json`.

## Credentials

### Bedrock

The plugin passes the AI SDK a model object built from the AWS SDK default credential chain, so any source that chain supports works.

- On AWS (EC2, ECS, EKS): attach a role with `bedrock:InvokeModel`. Nothing else is needed.
- Off AWS, short-term credentials: IAM Roles Anywhere. Its credential helper runs as `credential_process` or `serve` and returns sessions that refresh themselves. It needs your own CA and a certificate.
- Off AWS, simplest: a long-term Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK`. AWS calls long-term keys exploration-only. Short-term keys expire within 12 hours and cannot be refreshed through an environment variable.

When `AWS_BEARER_TOKEN_BEDROCK` is set it takes precedence over the credential chain.

### Lambda

The plugin invokes your gateway function with `{"system": "...", "prompt": "..."}` and expects `{"text": "..."}` back. The function holds the model choice and the Bedrock permissions, so The Lounge host needs only `lambda:InvokeFunction` on that function. Credentials come from the same AWS SDK default chain as Bedrock. The client uses the dual-stack endpoint (`lambda.<region>.api.aws`), so an IPv6-only host works. Setting `AWS_ENDPOINT_URL_LAMBDA` or `AWS_ENDPOINT_URL` replaces it, because the SDK rejects dual-stack with a custom endpoint. A function error is logged to the server log and never shown in the channel. The AI SDK is not loaded for this provider.

### Anthropic

Set `ANTHROPIC_API_KEY` in the environment of The Lounge process. The plugin refuses to start the provider without it.

## Scope

On-demand catch-up in the requesting user's own client. Output reaches only the user who ran the command. The plugin stores nothing and builds no per-person profiles. See [SECURITY.md](SECURITY.md) for what it reads and sends.

## Prior art

No published The Lounge plugin summarizes channel history (npm keyword `thelounge-plugin`, searched 2026-10-05).

## Requirements and limitations

- Node.js 22.17 or newer.
- The Lounge 4.5.2 or newer in the 4.x line.
- Requires message logging to sqlite (`messageStorage: ["sqlite"]` and a user with logs enabled). Text-only logging is not read.
- The plugin API has no hook for incoming messages, so the plugin reads the sqlite log on demand.
- Loading the AI SDK adds about 35 MB RSS on first use (measured on Node 24). Loading the Lambda client adds about 28 MB (same measurement).
- Bedrock is not reachable over IPv6 in the regions checked; an IPv6-only host needs the `lambda` provider, the `anthropic` provider or IPv4 egress.
- Changes to `config.json` need a restart.
- Lobby and server-window messages are never logged by The Lounge and cannot be summarized.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
