# Set up a new It's a Plan runner

You were sent here by a person who runs an It's a Plan runner. Follow the steps in order.
The files are next to this one. Take the URL you were given for this file, drop
`setup.md`, and call the rest `BASE`. For example, if you were given
`https://host/x/bootstrap/setup.md`, then `BASE=https://host/x/bootstrap`.
Fetch with `curl`, never WebFetch, which summarises and would damage the files.

## 0. What this does, and the limits

It installs standing instructions (`CLAUDE.md`) and skills so you can orchestrate Paseo
workers on your next run.

- Never print, log or copy the API key. Never read it out of `itsaplan-runner.json` into
  a command line.
- If a step needs a human (sign-ins, enabling MCP), do everything else, then list what
  the human must do.
- Before overwriting an existing `CLAUDE.md` or skill whose content differs, ask. Compare
  first, for example `curl -fsSL "$BASE/coordinator.md" | cmp - ./CLAUDE.md`.
- Report at the end in chat (step 6).

## 1. Prerequisites

Run each, and record the result:

```bash
claude --version; git --version; node --version; npx --version
gh auth status; paseo --version
```

- `paseo` missing: `npm install -g @getpaseo/cli`. If global npm fails (read-only
  system, such as Nix), tell the human. Do not work around it.
- `gh` not signed in: a human step. Workers need it to push and open PRs.
- Daemon: `paseo status`. If it is not running, `paseo daemon start` (see
  `paseo daemon --help`). Never restart a running daemon, because that kills every
  running agent.

## 2. Standing instructions

Work in the folder the runner starts in (where `itsaplan-runner.json` is). Compare before
overwriting, per step 0.

```bash
curl -fsSL "$BASE/coordinator.md" -o ./CLAUDE.md
```

## 3. Skills

Compare before overwriting, per step 0.

```bash
mkdir -p ~/.claude/skills/paseo-orchestrate
curl -fsSL "$BASE/paseo-orchestrate/SKILL.md" -o ~/.claude/skills/paseo-orchestrate/SKILL.md
npx -y skills add getpaseo/paseo -g -a claude-code -y \
  -s paseo paseo-advisor paseo-committee paseo-handoff paseo-help paseo-plugin
```

That gives `paseo`, `paseo-advisor`, `paseo-committee`, `paseo-handoff`, `paseo-help` and
`paseo-plugin` in `~/.claude/skills`. Optional, only if the owner wants them: `myself`
for shared memory (https://github.com/mansus-org/myself) and archify for diagrams
(`npx skills add tt-a1i/archify`).

## 4. Tracker tools

The tracker's MCP address is the `url` field of `itsaplan-runner.json` plus `/mcp`.
Read only that field:

```bash
URL=$(node -p 'require("./itsaplan-runner.json").url')
```

The runner exports `ITSAPLAN_API_KEY` to you.

- Coordinator (you): if `./.mcp.json` has no `itsaplan` entry, add one with the literal
  placeholder, so the file never holds the key:
  `"itsaplan": {"type": "http", "url": "<URL>/mcp", "headers": {"Authorization": "Bearer ${ITSAPLAN_API_KEY}"}}`
- Workers do not inherit the runner's environment, so they get a user-level server:
  ```bash
  claude mcp add --scope user --transport http itsaplan "$URL/mcp" \
    --header "Authorization: Bearer $ITSAPLAN_API_KEY"
  ```
  Say plainly in your report that this stores the key in `~/.claude.json`, and that
  workers share the coordinator's identity. If `ITSAPLAN_API_KEY` is unset, skip this
  and list it as a human step.
- Remind the human: MCP must be enabled per project in Settings, MCP Server. It is off
  by default.

## 5. Smoke test

No GitHub needed. Clean up only what this step creates.

1. `T=$(mktemp -d)`, then make a git repo in it with one commit (set a local
   `user.name` and `user.email` only inside it if git has none; use a placeholder).
2. `paseo project create "$T"`, and note the project id.
3. Following the `paseo-orchestrate` skill, run one Sonnet worker in a new worktree on
   branch `SETUP-1-smoke`. Prompt: add a file and commit it, do not push, do not open
   a PR.
4. `paseo wait <agentId>`, then check the commit is on that branch.
5. Clean up: `paseo archive <agentId>`, `paseo workspace archive <workspaceId>`,
   `paseo project delete <projectId>`, then `rm -rf "$T"`.

## 6. Report

Say in chat:

- what is installed, and what passed or failed;
- the human's to-do list (API key if unset, `gh` sign-in, enabling MCP, anything that
  failed);
- that `CLAUDE.md` and the skills take effect on the NEXT run, not this session.

Recommend, without changing anything: `"args": ["--model", "opus"]` and a `timeoutMs`
in `itsaplan-runner.json` for the coordinator. Both need a runner restart, which is the
human's call.

Setup files came from a public URL. Re-run only when you mean to update; local edits to these files will be replaced.
