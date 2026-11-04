---
title: "Running the Code Factory"
title_es: "Operar la fábrica de código"
dek: The first article explained how the factory is built. This one is the operator's notebook. Which skills the coordinator uses, how it picks a worker, and the rules we wrote down after the host fell over.
dek_es: El primer artículo explicó cómo está montada la fábrica. Este es el cuaderno del operador. Qué skills usa el coordinador, cómo elige a un agente y las reglas que escribimos cuando el servidor se cayó.
summary: "The skills the coordinator can load, three models to pick from, and the rules that keep one small host alive: how many workers, one start at a time, fresh worktrees after a failure. Plus how the agents' memory grew up."
summary_es: "Las skills que puede cargar el coordinador, tres modelos entre los que elegir y las reglas que mantienen vivo un servidor pequeño: cuántos agentes, de uno en uno, worktrees nuevos tras un fallo. Y cómo creció la memoria de los agentes."
category: architecture
number: 8
date: 2026-11-04
needs_summary: a fair way to measure cost per ticket, and ways to survive a daemon restart
needs_summary_es: una forma justa de medir el coste por ticket y maneras de sobrevivir a un reinicio del demonio
needs_label: help out
needs_label_es: ayúdanos
handover: The rules below came from things breaking, and more will. We still cannot say what a ticket costs, workers still share the coordinator's identity in the tracker, and a daemon restart still kills every running agent. If you have solved any of these, tell us.
handover_es: Las reglas de abajo salieron de cosas que se rompieron, y se romperán más. Seguimos sin saber cuánto cuesta un ticket, los agentes siguen compartiendo la identidad del coordinador en el gestor de tareas y reiniciar el demonio sigue matando a todos los agentes en marcha. Si has resuelto alguno de estos problemas, cuéntanoslo.
needs:
  - A fair way to measure cost per ticket, including the Qwen runs that cost nothing but time
  - A real read-only tracker identity for workers, so "read only" is enforced and not just requested
  - Ways to survive a daemon restart, so running agents are not lost
needs_es:
  - Una forma justa de medir el coste por ticket, incluidas las ejecuciones de Qwen que no cuestan dinero pero sí tiempo
  - Una identidad de solo lectura de verdad para los agentes en el gestor de tareas, para que "solo lectura" se imponga y no solo se pida
  - Maneras de sobrevivir a un reinicio del demonio, para no perder los agentes en marcha
---

[The first article](/articles/classic-code-factory/) explained what the factory is. This one is what we learned running it. Short rules, each with its reason.

## The skills

The factory's knowledge is a few written skills. A skill is a markdown file the coordinator loads when it needs it. These are available to it, not used on every ticket.

| Skill | What it is for |
| --- | --- |
| `paseo-orchestrate` | Ours, and the main one. The whole coordinator job: find the repo, split the work, pick the model, start workers, review, report, clean up. |
| `paseo` | Reference for the Paseo CLI: projects, workspaces, agents, schedules. |
| `paseo-advisor` | A second opinion from one agent. |
| `paseo-committee` | Two high-reasoning agents do root cause analysis and write a plan. For when the coordinator is stuck or looping. |
| `paseo-handoff` | Pass a task to another agent with full context. |
| `myself` | Long-term memory, covered below. |
| `antislop`, `archify`, `legible-type` | Writing and UI rules, diagrams, and typography for our sites. |

## Picking the worker

The first article described a cheaper default model and a stronger one for hard parts. Now there are three.

- **Qwen 3.8 27B**, self-hosted and free, on the pi harness. For well-specified work with a check you can run, a few files, and nobody waiting.
- **Sonnet 5.5**, the default. Everything else, including review and analysis answers, urgent work, and security-sensitive or unclear tickets.
- **Opus 5.5**, for the hard or risky parts.

On 2026-11-03 we ran an eval behind this: 17 tasks, 2 Qwen runs each. 33 of 34 graded runs passed, with code review scored separately. Qwen is 5 to 20 times slower than Sonnet. A typical run takes 1 to 10 minutes. A from-scratch sqlite HTTP API took 37 minutes, about 30 of them silent planning. Sonnet took 1.

::: pull
A silent Qwen worker is usually planning, not stuck.
:::

The failures tell you how to use it. In both code review runs it wrote the whole answer in its reasoning, sent no final message, and missed a planted bug. One cron parser run skipped a matching hour while its own 57 tests passed. So we give it edge cases as tests, and we run the acceptance command ourselves instead of trusting "tests pass". We give a quiet worker 60 minutes, then hand the task to Sonnet in a fresh worktree. Pi workers have no MCP tools, so they cannot read the ticket. The brief has to carry its text.

The start command, from the skill. For Qwen, use `--provider pi --model <qwen>` and drop `--mode`.

```paseo-orchestrate/SKILL.md (starting a worker)
paseo run -d --json \
  --new-workspace worktree --cwd /workspace/<repo> \
  --new-branch <KEY-N>-<slug> --base origin/main \
  --provider claude --model claude-sonnet-5-5 --mode bypassPermissions \
  --title "<KEY-N> <part>" --label issue=<KEY-N> \
  "$(cat /tmp/<KEY-N>-<slug>.md)"
```

## Keeping the host alive

We learned these by breaking things. It is one small host: 7.7 GB of RAM, no swap.

- **At most 3 or 4 pi workers, and archive each as soon as you have its result.** An idle pi agent holds about 80 MB until archived. With about 25 left around, the host ran out of memory and Paseo stopped responding.
- **Start workers one at a time.** Parallel `paseo run` calls overload the daemon and most of them fail.
- **Check the load before choosing Qwen.** At load around 85, a Qwen run made no commit in 1h45m.
- **After a failed start, use a fresh worktree.** The daemon caches a failed model refresh per directory, so a retry in the same folder fails instantly. Nobody restarts the daemon from inside an agent, because that kills every running agent, including the one doing it.
- **A failed start leaves its workspace behind.** Reuse it or archive it. Archive a worktree only after `git status` is clean and everything is pushed.
- **Claude workers need bypassPermissions.** Without it they stall forever on a prompt nobody will answer.
- **Run agents through Paseo, never from a shell script.** Through Paseo they show in the app. From a script they are hidden.
- **No Go on the PATH.** The host is a NixOS container. Workers are told to use `nix shell nixpkgs#go -c go ...`. Hardcoded store paths get garbage-collected.

## Memory grew up

The first article described small note files. Agents now also share a brain: [`myself`](https://github.com/mansus-org/myself), a graph of facts on a server, queried with a CLI and backed up to a private git repository. At session start `myself prime` prints a short summary.

On 2026-11-01 and 02 we rewrote one article many times with different prompts. What is in the prime gets used on every run. The deeper graph gets read only when the prompt gives concrete lookup steps and asks what was used.

We also tried a hook that injects search hits into each prompt. The owner rejected it as context pollution. The prime should say what the brain knows and when to fetch it.

One warning. The host's environment points at the production brain, so a test run without isolation once wrote about 118 records to production. Tests now strip those variables.

## Small things

- **Recurring work.** The tracker has no recurring tickets, and the runner's key cannot create tracker schedules. So a Paseo schedule starts an agent on a cron. The agent creates the ticket, and skips if it already exists.
- **A second runner.** A Qwen agent has its own runner and folder, and picks up work when mentioned. It is for very light tasks. It runs in a Paseo terminal and is not a service, so it needs restarting after a reboot.
- **Pull requests target main,** one per ticket or ticket group, not stacked on other branches.
- **The old rules hold.** Secrets never go in prompts, and humans merge. An agent merges only when the ticket says so.
