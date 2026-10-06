# thelounge-plugin-catchup

Summarizes what you missed in IRC channels on The Lounge, on demand and only in your own client, using the LLM you configure.

Status: scaffolding. The package loads in The Lounge but registers no command yet; `/summarize` arrives in 0.1.

## Install

```sh
thelounge install thelounge-plugin-catchup
```

## Quick start

Create `packages/thelounge-plugin-catchup/config.json` under `THELOUNGE_HOME`, give The Lounge process credentials for your provider (see Credentials), restart, then in any channel:

```
/summarize
/summarize 6h
```

## Configuration

`config.json` in the plugin's persistent storage directory (`THELOUNGE_HOME/packages/thelounge-plugin-catchup/`):

| Key        | Meaning                                      |
| ---------- | -------------------------------------------- |
| `provider` | `bedrock`. `anthropic` is planned.           |
| `model`    | Provider model or inference profile ID.      |
| `region`   | Provider region. Falls back to `AWS_REGION`. |

Unknown keys are rejected with a warning.

## Credentials

The plugin passes the AI SDK a model object built from the AWS SDK default credential chain, so any source that chain supports works.

- On AWS (EC2, ECS, EKS): attach a role with `bedrock:InvokeModel`. Nothing else is needed.
- Off AWS, short-term credentials: IAM Roles Anywhere. Its credential helper runs as `credential_process` or `serve` and returns sessions that refresh themselves. It needs your own CA and a certificate.
- Off AWS, simplest: a long-term Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK`. AWS calls long-term keys exploration-only. Short-term keys expire within 12 hours and cannot be refreshed through an environment variable.

When `AWS_BEARER_TOKEN_BEDROCK` is set it takes precedence over the credential chain.

The Anthropic provider (API key) is planned and not yet available.

## Scope

On-demand catch-up in the requesting user's own client. Output reaches only the user who ran the command. The plugin stores nothing and builds no per-person profiles. See [SECURITY.md](SECURITY.md) for what it reads and sends.

## Prior art

No published The Lounge plugin summarizes channel history (npm keyword `thelounge-plugin`, searched 2026-10-05).

## Requirements and limitations

- Node.js 22.17 or newer.
- The Lounge 4.5.2 or newer in the 4.x line.
- Requires message logging to sqlite (`messageStorage: ["sqlite"]` and a user with logs enabled). Text-only logging is not read.
- The plugin API has no hook for incoming messages, so the plugin reads the sqlite log on demand.
- Lobby and server-window messages are never logged by The Lounge and cannot be summarized.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
