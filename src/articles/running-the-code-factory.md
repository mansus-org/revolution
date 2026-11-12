---
title: "Running the Code Factory"
title_es: "Operar la fábrica de código"
dek: The first article explained how the factory is built. This one is the operator's notebook. Which skills the coordinator uses, how it picks a worker, and the rules we wrote down after the host fell over.
dek_es: El primer artículo explicó cómo está montada la fábrica. Este es el cuaderno del operador. Qué skills usa el coordinador, cómo elige a un agente y las reglas que escribimos cuando el servidor se cayó.
summary: "The skills the coordinator can load, how a ticket gets a model, and the rules that keep one small host alive: how many workers, one start at a time, fresh worktrees after a failure. Plus how the agents' memory grew up."
summary_es: "Las skills que puede cargar el coordinador, cómo un ticket recibe un modelo y las reglas que mantienen vivo un servidor pequeño: cuántos agentes, de uno en uno, worktrees nuevos tras un fallo. Y cómo creció la memoria de los agentes."
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
  - A fair way to measure cost per ticket, including the runs that cost nothing but time
  - A per-run timeout that scales with how many workers share one model server, instead of a constant we guess
  - A real read-only tracker identity for workers, so "read only" is enforced and not just requested
  - Ways to survive a daemon restart, so running agents are not lost
needs_es:
  - Una forma justa de medir el coste por ticket, incluidas las ejecuciones que no cuestan dinero pero sí tiempo
  - Un tiempo máximo por ejecución que escale con cuántos agentes comparten un servidor de modelos, en vez de un número que adivinamos
  - Una identidad de solo lectura de verdad para los agentes en el gestor de tareas, para que "solo lectura" se imponga y no solo se pida
  - Maneras de sobrevivir a un reinicio del demonio, para no perder los agentes en marcha
---

[The first article](/articles/classic-code-factory/) explained what the factory is. This one is what we learned running it. Short rules, each with its reason.

## Point your runner here

A new runner can set itself up. Put `itsaplan-runner.json` in an empty folder and send its agent one line:

```
Read https://revolution.mansus.org/bootstrap/setup.md and follow it.
```

It installs [standing instructions](/bootstrap/coordinator.md) and [skills](/bootstrap/paseo-orchestrate/SKILL.md), and tests Paseo. You still supply the API key, the `gh` sign-in and the MCP switch. Read [setup.md](/bootstrap/setup.md) first: you are handing your agent instructions from a web page.

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

Two of those, the advisor and the committee, belong to the reviewer lane. That lane has its own rule, below.

## Two lanes: one writes, one reads

Every factory has to decide which model gets which ticket. Ours has two lanes. A self-hosted model does all the code. A strong hosted model reads and advises, and never writes.

The split is a rule, not a preference. If the strong model is allowed to fix the code, every hard ticket quietly becomes a paid one and the free model never gets used. So the reviewer opens no branch, makes no commit, pushes nothing, comments on no ticket and merges nothing. It reviews diffs, does root cause analysis, and writes plans.

The worker model is the cheap one: self-hosted, free per token, and slow in wall clock. It gets work that is well specified, has a check you can run, stays inside a few files of an existing codebase, and has nobody waiting on it.

We ran an eval behind this on 2026-11-03: 17 tasks, two runs each on our self-hosted model. 33 of 34 graded runs passed, with code review scored separately. It is 5 to 20 times slower than the hosted default. A typical run took 1 to 10 minutes. A from-scratch sqlite HTTP API took 37 minutes, about 30 of them silent planning, where the default took 1.

::: pull
A silent worker is usually planning, not stuck.
:::

The failures tell you how to use it. In both code review runs it wrote the whole answer inside its reasoning, sent no final message, and missed a planted bug. One cron parser run skipped a matching hour while its own 57 tests passed. So we give it edge cases as tests in the brief, and we run the acceptance command ourselves instead of trusting "tests pass". Self-hosted harnesses often have no MCP tools, so the worker cannot read the ticket: the brief has to carry its text.

Then we changed the self-hosted model and learned about timeouts. Eight tasks, four workers at once, 14 minutes each: two finished and six were stopped mid-flight, having written nothing useful. Repeated one at a time with a 55 minute backstop, the same tasks finished on their own in about 35 minutes each, with working code and tests. A capped run and a failed model look identical in the logs, so read your timeout before you blame the worker.

That leaves no escalation path upward. When a worker fails, the reviewer rewrites the brief and the worker runs again in a fresh worktree.

The start command, from the skill.

```paseo-orchestrate/SKILL.md (starting a worker)
paseo run -d --json \
  --new-workspace worktree --cwd <repo path> \
  --new-branch <KEY-N>-<slug> --base origin/main \
  --provider <provider> --model <model> --mode <permission mode> \
  --title "<KEY-N> <part>" --label issue=<KEY-N> \
  "$(cat /tmp/<KEY-N>-<slug>.md)"
```

For a self-hosted worker, swap the provider and model and drop `--mode`: hosted agents need a permission mode or they stall on a prompt nobody will answer, while self-hosted ones run their tools without asking.

## Keeping the host alive

We learned these by breaking things. Our first host was one small box: 7.7 GB of RAM, no swap. The rules survived a hardware upgrade, the reasons moved.

- **At most 3 or 4 self-hosted workers, and archive each as soon as you have its result.** An idle agent holds about 80 MB until archived. With about 25 left around, that small host ran out of memory and Paseo stopped responding.
- **On a bigger box the model server is the limit, not the machine.** Workers share one server, and four of them at once finished nothing in 14 minutes while the same tasks alone took about 35 each. Watch the server's own metrics, queue depth and KV cache, before you blame a worker for being slow.
- **Start workers one at a time.** Parallel `paseo run` calls overload the daemon and most of them fail.
- **Check the load before choosing the slow model.** At load around 85, one run made no commit in 1h45m.
- **After a failed start, use a fresh worktree.** The daemon caches a failed model refresh per directory, so a retry in the same folder fails instantly. Nobody restarts the daemon from inside an agent, because that kills every running agent, including the one doing it.
- **A failed start leaves its workspace behind.** Reuse it or archive it. Archive a worktree only after `git status` is clean and everything is pushed.
- **Hosted workers need a permission mode that lets them act.** Without it they stall forever on a prompt nobody will answer.
- **Run agents through Paseo, never from a shell script.** Through Paseo they show in the app. From a script they are hidden, and you will forget they exist. Our own eval harness broke this rule and its runs were invisible for an afternoon.
- **Check the host before you copy a rule across.** The small host had no Go on the PATH, so workers were told to pull it from nixpkgs, and hardcoded store paths got garbage-collected. The next host had Go installed and the rule was just noise.

## Memory grew up

The first article described small note files. Agents now also share a brain: [`myself`](https://github.com/mansus-org/myself), a graph of facts on a server, queried with a CLI and backed up to a private git repository. At session start `myself prime` prints a short summary.

On 2026-11-01 and 02 we rewrote one article many times with different prompts. What is in the prime gets used on every run. The deeper graph gets read only when the prompt gives concrete lookup steps and asks what was used.

We also tried a hook that injects search hits into each prompt. The owner rejected it as context pollution. The prime should say what the brain knows and when to fetch it.

One warning. The host's environment points at the production brain, so a test run without isolation once wrote about 118 records to production. Tests now strip those variables.

## Small things

- **Recurring work.** The tracker has no recurring tickets, and the runner's key cannot create tracker schedules. So a Paseo schedule starts an agent on a cron. The agent creates the ticket, and skips if it already exists.
- **A second runner.** The cheap model has its own runner and folder, and picks up work when mentioned. It is for very light tasks. It runs in a Paseo terminal and is not a service, so it needs restarting after a reboot.
- **Free is not free.** A 35 minute run costs nothing in tokens and everything in wall clock and model-server time. Two of them at once cost more than double.
- **Pull requests target main,** one per ticket or ticket group, not stacked on other branches.
- **The old rules hold.** Secrets never go in prompts, and humans merge. An agent merges only when the ticket says so.
