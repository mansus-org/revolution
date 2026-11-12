---
name: paseo-orchestrate
description: Coordinate coding work through Paseo. The Itsaplan runner owns the ticket and delegates all code changes to Paseo worker agents (a cheap self-hosted model for well-specified, test-checkable work when you have one, your default hosted model for everything else, your strongest model for hard parts), each in its own git worktree on a branch named after the issue, then reviews their diffs, makes sure pull requests are opened with gh, reports on the issue, and cleans up. Use when an Itsaplan task or the user asks to change code in a repo, open, review or fix a PR, or work on several repos or subtasks in parallel. Do not use for questions that need no code changes.
---

# Coordinating work with Paseo

Paseo (`paseo` CLI) runs on this host and manages projects (repos), workspaces
(a local checkout or a git worktree), and agents running inside them. `gh` is
authenticated on GitHub.

## Roles

- **Coordinator (you, the Itsaplan runner).** You own the ticket from start to finish:
  read it, plan, pick the repo, start workers, review their diffs, make sure a PR exists,
  report on the issue, move its state, clean up. You don't edit code in repos yourself.
  Even a one-line fix goes to a worker. That way every change lands in a worktree and a
  PR, with nothing left behind in a checkout.
- **Workers (Paseo agents).** Each one works in its own worktree on its own branch,
  commits, pushes, and opens a draft PR. Hosted workers can be given the itsaplan MCP
  tools at user scope (same agent identity as you), so they can read the issue, its
  comments, attachments and linked docs themselves. The ticket stays yours: workers
  only read it. They don't move it, comment on it or edit it. Still put the goal, scope
  and acceptance in the prompt, so they don't have to guess what you decided. Self-hosted
  harnesses usually expose no MCP tools at all, so their prompt must carry the ticket
  text itself.
- **Reviewer (optional, and the strongest model you have).** It reviews diffs, does root
  cause analysis and writes plans. It never opens a branch, commits, pushes, comments on
  a ticket or merges. See section 3.

Never edit files in a project's main checkout. It holds the owner's own uncommitted
work.

## Ask the owner on first use

- PR base branch: if it isn't `main`, ask, and use it for `--base` and `gh pr create --base`.
- Git identity: if `git config user.name` and `user.email` are empty, ask the owner what
  to commit as. Never invent an identity.
- Model lanes: which model is the cheap worker, the default worker, the strong worker and
  the reviewer. List what the host has with `paseo provider ls` and
  `paseo provider models <provider>`, then write the answer into your own copy of this
  skill so you stop asking.

## 1. Understand the ticket and find the repo

Read the issue (and comments) through the itsaplan MCP tools. If what's wanted, or
which repo it targets, is unclear, ask in the chat or on the issue before you start
workers.

```bash
paseo project ls --json          # projectId, name, kind (git|non_git), path
paseo workspace ls --json        # existing workspaces: workspaceId, name, isolation, cwd
paseo ls -g --label issue=<KEY-N> --json   # workers already started for this issue
```

- Repo not registered yet: `paseo clone owner/repo --dir <parent folder>`, or
  `paseo project create /path/to/checkout` for an existing clone.
- Your own folder, the one the runner starts in, is not a git repo. Never create
  worktrees from it.

## 2. Plan the split

- One worker per independent unit: a separate repo, or areas of one repo that don't
  touch the same files. Most tickets need just one worker.
- Parts that depend on each other go to the same worker, or run one after the other.
- Each worker gets its own branch: `<KEY-N>-<slug>` for a single worker,
  `<KEY-N>-<part-slug>` when there are several. Repos with a `paseo.json` worktree hook
  (some do) parse this name to link the worktree to the issue, so keep the format
  exact.

## 3. Pick the lane

| Lane | Flags | Use for |
|---|---|---|
| Cheap worker (self-hosted, optional) | `--provider <provider> --model <cheap-model>` | well-specified work with a check you can run |
| Default worker | `--provider <provider> --model <default-model> --mode <permission mode>` | everything else |
| Strong worker | the same flags with your strongest model | hard or risky parts: tricky design, security-sensitive, large refactor |
| Reviewer | your strongest model, with a read-only brief | review, root cause analysis, plans |

If you have no cheap self-hosted model, skip the first row and the notes below about
slow workers.

The reviewer lane has one rule: it reads and advises, it never writes. If the strong
model is allowed to fix the code, every hard ticket quietly becomes an expensive one and
the cheap model never gets used. Give the reviewer its own worktree on the same branch
(`--worktree-mode checkout-branch --branch <branch>`) so there is nothing for it to
dirty, tell it to change no file, and check `git status --porcelain` in its cwd when it
answers.

Here is how we use our cheap self-hosted model. It costs nothing and its code is usually
right, but it is 5 to 20 times slower than our default. In a 2026-11-03 eval (17 tasks,
2 runs each) it passed 33 of 34 graded runs: renames, bug fixes against failing
tests, a small feature over 3 files, a refactor into modules, test writing (100%
coverage, every mutant killed), shell scripts, git chores, log analysis, a concurrency
lock, a strict-TS cleanup, a sqlite HTTP API, and Q&A on a codebase, including a real
repo with correct file:line citations. Typical time was 1 to 10 minutes, and 30 to
37 minutes for the from-scratch API and cron parser. Our default did each hard task in
under a minute. The one failure: one of two cron-parser runs skipped a matching hour,
and its own 57 tests didn't catch it. For logic-heavy code, give it the edge cases as
tests in the prompt, or check them yourself.

Use the cheap model when all of these hold:
- The ticket says exactly what to change, and the acceptance criteria are a command
  (tests, build, a script) or something you can check in the diff yourself.
- The work stays in a few files of an existing codebase.
- Nobody is waiting on it: a run can take 10 to 40 minutes.
- The prompt can say everything the worker needs. A self-hosted harness usually has no
  MCP servers, so it can't read the itsaplan ticket. Paste in the relevant issue text.

Use the default or strong model instead for:
- **Answers with no tool calls** (code review, analysis, plans). In both review runs,
  our cheap model wrote its whole answer inside its reasoning and sent no final
  message. It also missed one planted bug both times.
- **Building something sizeable from scratch from a long spec, when time matters.** On
  an HTTP API task (sqlite, 6 routes, validation) it spent about 30 minutes planning in
  its reasoning before writing a file. It passed, but took 37 minutes where our default
  took 1.
- Security-sensitive changes, unclear tickets, and anything urgent.

A worker with no tool calls for a long stretch is usually still planning, not stuck.
Budget for it, and scale the budget to how many workers share your model server. We
learned that the hard way on a second self-hosted model: eight tasks, four workers at
once, a 14 minute cap, and two runs finished while six were stopped mid-flight. Repeated
one at a time with a 55 minute backstop, the same tasks finished on their own in about 35
minutes each. A capped run and a failed model look identical in the logs, so read the
timeout before you blame the worker.

When a worker fails and you have a stronger model, hand the task to it in a fresh
worktree. If the cheap model is the only one you want writing code, keep the failure in
the cheap lane: have the reviewer rewrite the brief and start the worker again in a
fresh worktree.

## 4. Start workers

New branch in a new worktree:

```bash
git -C <repo path> fetch origin
paseo run -d --json \
  --new-workspace worktree --cwd <repo path> \
  --new-branch <KEY-N>-<slug> --base origin/main \
  --provider <provider> --model <model> --mode <permission mode> \
  --title "<KEY-N> <part>" --label issue=<KEY-N> \
  "$(cat /tmp/<KEY-N>-<slug>.md)"
# → {"agentId":"…","cwd":"<home>/.paseo/worktrees/<hash>/<KEY-N>-<slug>",…}
```

Write the prompt to a file first, then pass it as the last argument. (`paseo run` has no
`--prompt-file`. `paseo send` does.)

Other starting points:
- Existing branch: `--new-workspace worktree --worktree-mode checkout-branch --branch <name>`
- Existing PR (fix CI, address review comments): `--new-workspace worktree --worktree-mode checkout-pr --pr-number <n>`
- Workspace you already have: `--workspace <wks_id>`. Reuse the issue's existing
  workspace when you continue earlier work.

For a cheap self-hosted worker, swap the provider line for `--provider <provider> --model
<cheap-model>` and drop `--mode` if the harness runs its tools without asking.

Rules:
- Always pass `--workspace` or `--new-workspace`. Without either, `paseo run` uses the
  caller's workspace (`$PASEO_WORKSPACE_ID`), which is your own folder.
- Without a permission mode that lets it act, an unattended hosted worker stalls on
  permission prompts nobody is there to answer. `paseo provider ls --json` lists the
  modes each provider offers.
- Start workers one at a time and wait for each `paseo run` to return. Parallel
  `paseo run` calls overload the daemon, and most of them fail.
- Keep at most 3 or 4 self-hosted workers running, and fewer if they share one model
  server. On a small host, count memory: each idle agent holds about 80 MB, and about 25
  of them once took a 7.7 GB host down. Every agent, idle ones included, keeps a process
  alive until you archive it, and with that many around Paseo stopped responding. On a
  big host the machine is not the limit, the model server is: watch its own metrics
  (queue depth, KV cache) before you blame a worker for being slow.
- `AGENT_CREATE_FAILED … Timed out refreshing <provider> … get_available_models`: the daemon
  caches that failure for the directory, so every retry in the same cwd fails
  instantly. Start in a fresh worktree (new slug) instead. If that also fails, tell the
  user the Paseo daemon needs a restart. Don't restart it yourself, because that kills
  every running agent, you included.
- When `paseo run --new-workspace` fails to start the agent, the workspace it created
  stays behind. Reuse it with `--workspace <wks_id>` or archive it.
- Always add `--label issue=<KEY-N>` so you, or a later run, can find the workers.

### Worker prompt template

A worker knows nothing about this conversation. It can read the ticket through the
itsaplan tools, but write the prompt so it stands on its own:

```
You are working in a git worktree of <owner>/<repo>, on branch <branch>.
Ticket: <KEY-N>. Read it (and its comments/attachments) with the itsaplan MCP tools
(get_issue_by_number) for context. Read only: don't move, comment on, or edit the
issue. The coordinator reports on it.
Goal: <what to build/fix, and why, in plain terms>.
Scope: <files/areas to touch; what NOT to touch>.
Acceptance: <how to tell it's done>.
Follow the repo's CLAUDE.md / AGENTS.md / .pi/skills conventions.
Test with: <commands, if known; otherwise "find and run the repo's tests/build">.
Commit in small steps with messages "<KEY-N> <summary>", staging specific paths
(not `git add -A`); don't commit paseo.json unless the repo already tracks it.
End each commit message with the attribution lines your harness requires.
When done: git push -u origin HEAD, then open a draft PR:
  gh pr create --draft --base main --title "<KEY-N> <summary>" --body "<what/why/how tested>"
(if a PR for this branch exists, push to it instead). Never merge or force-push to main.
Final reply: the PR URL, a 2 to 4 line summary, test results, anything left undone.
```

For a worker with no tracker tools, replace the "Ticket:" lines with the issue's title,
description and any comments that matter, pasted in. Keep the acceptance concrete: name
the test command, the expected output, the files to touch. A cheap model does well
against a check it can run and drifts without one. Also add: "Write the final reply as a
normal message, not only in your reasoning."

## 5. Watch, steer, review

```bash
paseo wait <agentId> --timeout 1500         # block until idle (repeat as needed)
paseo logs <agentId> --tail 20              # what it did / said (--filter errors|tools)
paseo send <agentId> "follow-up instruction"  # continue the same worker
paseo permit ls                             # a worker stuck on a permission prompt
paseo stop <agentId>                        # interrupt
```

- Keep your whole run under `$ITSAPLAN_TIMEOUT_MS`. Track the time you've spent, wait
  with `--timeout`, and leave a margin for review and reporting.
- Workers belong to the Paseo daemon, not to your process. They keep running if your run
  ends. If you run out of time, report what's still running (agent ids, branches) on the
  issue rather than abandoning it silently.
- Slow self-hosted workers: wait in rounds of `--timeout 600` and check `paseo logs <id> --filter tools
  --tail 5` between rounds. Long gaps with no tool calls are planning, so let it
  run. Past your budget, `paseo stop` it and move the task to the next lane.
- If a worker goes idle with no final message, its answer may be in a `[Thought]` block
  of `paseo logs <id>`. Ask once: `paseo send <id> "Write your final answer now as a
  plain message."`
- Don't trust a "tests pass" from a worker. Run the acceptance command yourself in the
  worker's cwd. This matters most with the cheap model.
- Review each worker's diff before you accept it:
  `git -C <worker cwd> fetch origin && git -C <worker cwd> diff origin/main...HEAD`.
  Check it against the ticket's acceptance criteria. If it falls short, `paseo send` the
  worker the specific fixes and wait again.
- Confirm the PR: `gh pr view <branch> --repo <owner>/<repo> --json url,state,isDraft`,
  plus `gh pr checks <n> --repo <owner>/<repo>` once CI has run.
- When the work is complete and checks pass, mark it ready: `gh pr ready <n> --repo <owner>/<repo>`.
  Leave it as a draft when parts are missing or failing.

## 6. Report on the ticket

Post one comment on the issue with the itsaplan MCP tools: the PR link(s) and one or two
plain sentences on what was done. Then set the issue state per the itsaplan MCP
instructions: "completed" when the PR is ready for review and covers the ticket, and
leave it "started" with a comment saying what's left if work remains.

Never merge PRs yourself unless the ticket says so explicitly.

## 7. Clean up

After a worker's work is pushed and the PR exists:

```bash
paseo archive <agentId>                 # each worker you started (also frees its process)
paseo workspace archive <workspaceId>   # removes the worktree dir (runs the repo teardown hook)
```

- The workspace id is not in `paseo run --json` output: find it with
  `paseo workspace ls --json`, matching the worker's cwd.
- Archive a workspace only after `git -C <cwd> status --short` is clean and everything is
  pushed. Archiving deletes the worktree directory, and anything unpushed in it is lost.
- Keep the workspace (and say so on the issue) when review changes are likely soon.
  Archive it once the PR is merged or closed.
- The local branch survives archiving. Leave it, because the remote branch backs the PR.
- Archive workers as soon as you have their result, even when you keep the
  workspace. An idle agent still holds memory and a process (see section 4).
- Never archive workspaces or agents you didn't start for this ticket.

## Quick reference

| Need | Command |
|---|---|
| Repos / workspaces | `paseo project ls --json` · `paseo workspace ls --json` |
| Workers for an issue | `paseo ls -g --label issue=<KEY-N> --json` |
| Worker in new worktree | `paseo run -d --json --new-workspace worktree --cwd <repo> --new-branch <b> --base origin/main --provider <provider> --model <model> --mode <permission mode> --label issue=<KEY-N> "<prompt>"` |
| Worker on a PR | `… --new-workspace worktree --worktree-mode checkout-pr --pr-number <n> …` |
| Wait / logs / follow-up | `paseo wait <id> --timeout 1500` · `paseo logs <id> --tail 20` · `paseo send <id> "…"` |
| Review | `git -C <cwd> diff origin/main...HEAD` · `gh pr view` · `gh pr checks` |
| Clean up | `paseo archive <agentId>` · `paseo workspace archive <wks>` |
| Cheap worker | same, with `--provider <provider> --model <cheap-model>`, no `--mode` if the harness does not ask |
| Reviewer | same, on `--worktree-mode checkout-branch --branch <b>`, strongest model, brief says change no file |
| Models | `paseo provider ls` · `paseo provider models <provider>` |
