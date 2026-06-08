# Changelog

Notable, user-facing changes to Loom and Orbit. Each release lists a short set of
highlights; the full commit-level notes live on the GitHub release pages. Add a
new `## [<version>] - <date>` block with a `### Highlights` list at release time.

## [0.3.1] - 2026-06-04

### Highlights

- Connect any OpenAI-compatible model endpoint, with a one-click Jetstream preset
- Orbit shows how full the context window is, right in the footer
- Lower per-turn token use, plus `/compact` to trim conversation history on demand

## [0.3.0] - 2026-06-03

### Highlights

- Orbit updates itself in place on macOS; the CLI now tells you when a new version is out (and `loom update` to get it)
- Claude Opus 4.8 is available, with corrected pricing
- `/orbit` hands a running CLI session off to the Orbit desktop app

## [0.2.0] - 2026-06-02

### Highlights

- The agent's file writes are confined to your analysis directory by default, with an opt-in bash sandbox and a local-execution approval gate
- Send feedback straight from Orbit or with `/feedback`

## [0.1.1] - 2026-05-29

### Highlights

- Signed and notarized macOS builds
