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

`today` and `since HH:MM` use the time zone of the server running The Lounge. A nick asks the model to focus on what that person said. If the window holds more than 200,000 characters the newest part is summarized and the reply says so. Timestamp gaps over 60 minutes are reported in the summary.

## Configuration

`config.json` in the plugin's persistent storage directory (`THELOUNGE_HOME/packages/thelounge-plugin-catchup/`), read at server start:

| Key              | Meaning                                                              |
| ---------------- | -------------------------------------------------------------------- |
| `provider`       | Required. `bedrock` or `anthropic`.                                  |
| `model`          | Required. Bedrock model or inference profile ID, or Anthropic model. |
| `region`         | Bedrock only. Falls back to `AWS_REGION`.                            |
| `maxWindowHours` | Optional, default 24. Cap for the `since-last` window.               |

Unknown keys are ignored with a warning in the server log. Never put a key in `config.json`.

## Credentials

### Bedrock

The plugin passes the AI SDK a model object built from the AWS SDK default credential chain, so any source that chain supports works.

- On AWS (EC2, ECS, EKS): attach a role with `bedrock:InvokeModel`. Nothing else is needed.
- Off AWS, short-term credentials: IAM Roles Anywhere. Its credential helper runs as `credential_process` or `serve` and returns sessions that refresh themselves. It needs your own CA and a certificate.
- Off AWS, simplest: a long-term Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK`. AWS calls long-term keys exploration-only. Short-term keys expire within 12 hours and cannot be refreshed through an environment variable.

When `AWS_BEARER_TOKEN_BEDROCK` is set it takes precedence over the credential chain.

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
- Loading the AI SDK adds about 35 MB RSS on first use (measured on Node 24).
- Bedrock is not reachable over IPv6 in the regions checked; an IPv6-only host needs the `anthropic` provider or IPv4 egress.
- Changes to `config.json` need a restart.
- Lobby and server-window messages are never logged by The Lounge and cannot be summarized.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
