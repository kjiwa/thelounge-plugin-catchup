# Security

thelounge-plugin-catchup reads the requesting user's TheLounge sqlite log
(`logs/<user>.sqlite3` under `THELOUNGE_HOME`) on the machine it runs on. When
a user runs a command, it sends the selected window of messages, and only that
window, to the LLM provider you configured. It sends nothing to any other
service, has no telemetry, and stores nothing: no summaries, no profiles, no
copies of messages.

## Reporting a vulnerability

Please use
[GitHub's private vulnerability reporting](https://github.com/kjiwa/thelounge-plugin-catchup/security/advisories/new)
for this repository rather than opening a public issue. If that option isn't
available yet, email kamil.jiwa@gmail.com instead.
