# Skill: Post to Slack

Send a notification via the Slack bridge MCP server.

## Tool

`mcp__slack__notify(channel, message, mention?)`

The bridge resolves channel names to IDs internally — agents pass the human-readable channel name. `mention` is an optional GitHub login; the bridge maps it to a Slack user via profile lookup and falls back to literal `@<login>` text if no match.

## Channel routing

| Channel | Use for |
|---|---|
| `#alerts` | Urgent: requirement changes, deprecated tests, graduation, critical failures, env health issues, defect verification results |
| `#heartbeat` | Heartbeat run results |
| `#regression` | Regression and release-gate run results |
| `#metrics` | Weekly metrics report |

## Standard run result format

```
Status: PASS | FAIL
Pass rate: <n> / <total> (<pct>%)
Failed tests: <comma-separated list — omit line if none>
Allure report: <url>
Triggered by: <commit-sha> @<author>
```

## Fallback

If `mcp__slack__notify` fails (bridge unavailable, 5xx from Slack), write the message to `$GITHUB_STEP_SUMMARY`:

```bash
{ echo "## Slack delivery failed — original message:"; echo "$message"; } >> "$GITHUB_STEP_SUMMARY"
```

Never silently drop a notification.
