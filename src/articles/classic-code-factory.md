---
title: "A Classic Code Factory"
title_es: "Una fábrica de código clásica"
dek: We did not invent a new way to build software with AI. We kept the old one, tickets, branches, pull requests, review, previews and a human who merges, and put language models in some of the seats. This is how it works, why it is set up this way, and how to build your own.
dek_es: No inventamos una forma nueva de hacer software con IA. Mantuvimos la de siempre, tickets, ramas, pull requests, revisión, vistas previas y una persona que hace merge, y sentamos modelos de lenguaje en algunos de los puestos. Así funciona, por qué está montado así y cómo montar el tuyo.
summary: "A tracker, a coordinator agent that acts like a tech lead, worker agents that act like developers, and a human who reviews a live preview and merges. The agile flow, unchanged, with new people at some of the desks."
summary_es: "Un gestor de tareas, un agente coordinador que hace de jefe técnico, agentes que hacen de desarrolladores y una persona que revisa una vista previa en vivo y hace merge. El flujo ágil de siempre, con gente nueva en algunos puestos."
category: architecture
number: 7
date: 2026-10-29
needs_summary: people to try it on their own teams, and better ways to measure what the workers produce
needs_summary_es: gente que lo pruebe en sus propios equipos y mejores formas de medir lo que producen los agentes
needs_label: help out
needs_label_es: ayúdanos
handover: The factory works and wrote the articles on this site, but we have not measured how good its work is, what it costs, or where it breaks first. If you set up something like it, tell us what you find.
handover_es: La fábrica funciona y ha escrito los artículos de este sitio, pero no hemos medido lo bueno que es su trabajo, lo que cuesta ni dónde se rompe primero. Si montas algo parecido, cuéntanos qué descubres.
needs:
  - People who try the same setup on their own team, and tell us what broke first
  - A fair way to evaluate worker output beyond "the reviewer liked it"
  - Cost tracking per ticket, so we know what a change actually costs
  - Review tooling that helps a human read many small PRs without rubber-stamping them
  - Ideas for giving workers their own, read-only identity in the tracker instead of sharing the coordinator's
needs_es:
  - Gente que pruebe el mismo montaje en su propio equipo y nos cuente qué se rompió primero
  - Una forma justa de evaluar el trabajo de los agentes más allá de "al revisor le gustó"
  - Seguimiento del coste por ticket, para saber cuánto cuesta de verdad un cambio
  - Herramientas de revisión que ayuden a una persona a leer muchas PR pequeñas sin aprobarlas a ciegas
  - Ideas para dar a los agentes su propia identidad, de solo lectura, en el gestor de tareas en lugar de compartir la del coordinador
---

## What it is

Here is what it feels like from the product owner's seat. You open our tracker and write a ticket: what you want, and how you will know it is done. Or you just say it in a chat with the agent there. Some minutes later a comment appears on the ticket with a link to a pull request. The pull request has a link to a live preview of the change. You open the preview, use it, and either say "not yet, and here is why" or press merge. Merging ships it.

Between your ticket and that link, nothing unusual happened. Someone read the ticket and asked a question about the unclear part. Someone planned the work and split it up. Developers each took a branch, wrote the code, committed and opened a pull request. Someone reviewed the diff against the ticket and sent it back once. CI built a preview. Someone reported back on the ticket and tidied up. It is the same flow any agile team runs. The only difference is that most of those "someones" were language models.

::: pull
We kept the old factory exactly as it was, and changed who sits at some of the stations.
:::

The tracker is [It's a Plan](https://github.com/croffasia/itsaplan), an open-source alternative to Linear, running at plan.mansus.org. The agents are Claude Code sessions, started and supervised by [Paseo](https://paseo.sh), which runs many coding agents side by side. The code lives on GitHub, and every pull request gets a preview from [the app platform that gives every PR a preview](/articles/gitops-deploys-argocd/). Everything except GitHub and the models runs on our own small cluster.

::: figure Fig. 1
![The factory in four bands. Ask: the product owner writes a ticket or chats in It's a Plan. Plan and delegate: the ticket becomes an agent run, the runner starts the coordinator agent, and the coordinator delegates to Paseo. Build: Paseo starts workers, each in its own worktree on its own branch; they push and open a pull request, and CI builds it on runners in the cluster. Check and ship: the preview site gets its URL, a human reads it, reviews and merges, and the live site updates.](/articles/images/factory-map.png){colour wide}
Who sits where. The owner asks, the coordinator plans and delegates, workers build, CI makes a preview, and a human merges. The diagrams were made with [Archify](https://github.com/tt-a1i/archify); click or tap one to open it full size.
:::

## The core idea: keep the factory, change who sits at the stations

Most talk about AI and code imagines a new kind of process: one clever agent, a long prompt, and code that appears. That is fun for a demo. For real work it leaves the hard questions open. Who decided this change was wanted? Who checked it? What exactly changed, and can we undo it? Where do we look in a month, when something breaks?

Software teams answered those questions a long time ago, with a process that is a little boring and works. A tracker holds the work, and each ticket says what "done" means. Refinement turns a vague wish into something buildable. Each change lives on its own branch and arrives as a pull request. Someone other than the author reviews it. QA tries it somewhere safe. Someone with authority merges, and the merge deploys. Every step leaves a trace.

So we kept all of it. We did not write a new workflow for machines. We took the existing one and filled some of its seats with them. Two new roles appeared, and both are old roles:

- **The coordinator behaves like a tech lead.** It reads the ticket, asks when something is unclear, plans the work, hands parts to developers, reviews their diffs, reports on the ticket and cleans up. It does not write code itself.
- **Workers behave like developers.** Each one gets a written brief, works in its own copy of the repository on its own branch, commits, pushes and opens a pull request.

People keep the two seats that carry responsibility: the **product owner**, who decides what is wanted, and the **final reviewer**, who decides what ships. Between them, the tracker is the shared memory and the interface. It is where people and agents talk, and where the history of every decision lives.

## The stations, one by one

Follow one ticket through the factory. Each station is a step any developer would recognise.

**Ticket and refinement.** A person writes a ticket in It's a Plan, with acceptance criteria when they can. Projects have short keys, so a ticket is called something like BRAIN-44. Agents are members of the team there: you can mention them, delegate a ticket to them, chat with them, or schedule them. When a ticket is delegated, the tracker queues an *agent run*. A small program on our side, the It's a Plan runner, picks it up and starts the coordinator with the ticket. The coordinator reads the ticket and its comments. If what is wanted, or which repository it is about, is unclear, it asks before anything else happens. That is refinement, done in the same place it always was.

**Planning and delegation.** The coordinator decides how to split the work. Most tickets need one worker. Independent parts, such as two repositories or two areas of one repository that don't touch the same files, get one worker each. Parts that depend on each other stay with one worker. Then the coordinator writes each worker a brief: the ticket's key, the goal and why, what to touch and what not to, how to tell it's done, how to test it, how to name commits, and what to reply with. Workers can read the ticket themselves, with its comments, attachments and linked documents, so the brief doesn't have to carry all of that. But the decisions are the coordinator's, so goal, scope and acceptance are written into the brief anyway, and the worker never has to guess what was decided. The ticket stays the coordinator's: workers only read it. They never move it, comment on it or edit it.

**Building in isolation.** Paseo starts each worker in its own *git worktree*[^1]. That is a separate working copy of the repository on its own branch, named after the ticket, such as `BRAIN-44-reading-list`. Workers can run in parallel without touching each other's files. The person's own checkout, where they may have half-finished work, is never touched. By default the workers run a cheaper, faster model. A part that is hard or risky gets the stronger one.

::: note 1
A git worktree is a second working folder for the same repository, checked out on a different branch. Many can exist at once and they share one history.
:::

**The pull request.** The worker commits in small steps, with the ticket key at the start of each message, pushes, and opens a pull request. That is why the history of this site reads like any team's: commits named "BRAIN-44 Relay pivot articles…" and "BRAIN-64 About page…".

**Review, twice.** The coordinator reads the worker's diff against the ticket's acceptance criteria. If it falls short, the coordinator tells the same worker exactly what to fix and waits again. When the change is complete and the checks pass, it marks the pull request ready for review. Then a person reviews it. Agents never merge.

**QA on a live preview.** Every push to the pull request builds a preview: a real, running copy of the change at its own address, linked from the pull request. The human reviewer can try the change instead of reading the diff. For a website that means reading the page. For an app it means using it.

**Merge and deploy.** A human presses merge. The merge deploys, through the same platform that made the preview. Nobody touches a server.

**Report back and clean up.** The coordinator posts one comment on the ticket with the pull request link and a sentence or two on what was done, and moves the ticket to *completed*. If something is left undone, the ticket stays *started* and the comment says what remains. Then it archives the workers and deletes their worktrees, but only once everything in them is committed and pushed.

::: figure Fig. 2
![Sequence of one ticket. Ticket and refinement: the owner writes a ticket with criteria in It's a Plan, which sends an agent run to the coordinator through the runner; the coordinator asks the owner a question if anything is unclear. Build: the coordinator sends a brief to a worker, which reads the ticket for context, which pushes a branch with commits and opens a PR on GitHub; CI builds a preview on the cluster and the preview link is posted on the PR. Review: the coordinator reads the diff and checks, sends fixes to the worker if needed, and comments on the ticket and marks it completed; the owner reads the preview. Ship: the owner merges on GitHub, and main deploys to the cluster.](/articles/images/factory-one-ticket.png){colour wide}
One ticket from start to finish. The coordinator talks to the tracker and the workers; the workers talk to GitHub; only the owner merges.
:::

## A real run

The articles on this site are made this way, this one included. Here is the run that produced [the previous article](/articles/gitops-deploys-argocd/), told from the coordinator's side and trimmed.

The owner asked, in a chat in It's a Plan, for a document explaining our latest infrastructure change end to end, with a small app as the example. Answering questions and research don't need a worker, so the coordinator did that itself. It read the infrastructure repository, cloned the example app, checked the live site, drew diagrams, and ran the diagram tool's validator until it passed.

Next the owner asked for that document to be added to the infrastructure repository and linked from its README. That is a code change, so it went to a worker. The coordinator wrote a brief with the goal, scope and acceptance, and started a worker in a fresh worktree. The worker copied the files, linked them, committed, pushed and opened a pull request. The coordinator checked the diff: only the intended files, copied exactly. Then it archived the worker.

Later, preparing pictures for the article, the coordinator *looked* at the rendered diagrams instead of trusting the validator. It found its own mistake: one arrow showed the certificate check going to GitHub instead of Let's Encrypt. It fixed the source, checked it again, and sent a second worker to push the fix onto the same pull request. No reviewer had caught it yet. Looking at the output, not just at the checks, is what caught it.

Then the owner asked for an article on this site. Writing well was the hard part, so this worker got the stronger model. It wrote the article, built the site, took screenshots at desktop and phone widths, fixed the layout, and opened a pull request. CI built a preview on runners inside our cluster, and the preview was live within a few minutes. The owner read the preview, not the diff.

The review took three rounds, all on that preview:

1. "Too much about us; make it a how-to." It was rewritten as a step-by-step guide.
2. "No, I want the intuition, not code." It was rewritten as a showcase.
3. "Reads much better. Add an annex with the key config and links." The annex was added, every link checked, and every config excerpt parsed.

Each round was a new worker on the same pull request. The coordinator reviewed each round's diff, scanned it for secrets, checked the structure, confirmed the preview answered, and archived the worker. The owner merged.

About six workers took part in all, across two pull requests in two repositories. Each lived from a few minutes to about forty. Preview checks took a minute or two.

::: figure Fig. 3
![A review round on the preview. The owner reads the preview; if it is not ready yet, they leave feedback on the ticket. That starts a new round: the coordinator writes a prompt for a new worker on the same PR, the worker pushes, CI rebuilds, and the preview is updated in minutes. The coordinator reviews the diff and scans for secrets, and the preview is ready again for the owner to read. When it is good, the owner merges.](/articles/images/factory-review-round.png){colour wide}
One review round. The owner only ever reads the preview and writes feedback; the rest of the loop is agents and CI.
:::

## Why it's built this way

Each of these is a choice, and each has a cost.

**The old process is the guard-rail.** Tickets, branches, pull requests and review exist because people make mistakes. Machines make mistakes too, and the same structure catches them. Every change is small, named after a ticket, reviewable and revertible, whoever wrote it. The cost is ceremony: a one-line fix still gets a branch, a worker and a pull request.

**One worktree and one branch per worker.** Parallel workers can't step on each other, and a half-finished attempt never leaks into someone else's work. The rule that agents never edit the owner's own checkout matters as much: that folder may hold uncommitted work nobody else has seen. The cost is disk space and some setup per worker, and the coordinator has to clean up afterwards. It only deletes a worktree once everything in it is pushed.

**A tech lead and developers, not one agent.** The coordinator runs on the strongest model. It reads, plans and reviews, where judgement matters most. Workers default to a cheaper, faster model that is good at typing code against a clear brief. Splitting the roles also means the reviewer is never the author: the coordinator didn't write the diff it reads. The cost is that the brief still has to be good: the worker can read the ticket, but only the brief says what the coordinator decided.

**The tracker is the memory and the audit trail.** Agent sessions end and forget. The ticket doesn't. The question that was asked, the answer, the pull request link and the final report all live on the ticket, where the next person or agent will look. The cost is discipline: an agent must write to the ticket, not only to its own chat.

**Workers read the ticket; only the coordinator writes to it.** Workers have the tracker's tools, so they can read the ticket, its comments, attachments and linked documents for context. They never move it, comment on it or edit it. One writer per ticket means two agents never talk over each other on the same issue, and the history stays in one voice. The cost is that a worker who notices something worth saying has to say it in its reply, for the coordinator to pass on. We found this out by accident. The owner suspected workers "probably" had tracker access. A probe showed they didn't have the tools, but a stray config file on the host held a key in plain text, so they could have, by accident. We made it deliberate instead: the tools are set up once per host, for every worker.

**Humans merge.** The coordinator marks a pull request ready. It never merges, unless a ticket explicitly says so. Merging is the moment a change becomes real, and that decision stays with a person.

**Previews make review about behaviour.** Reading a long diff is tiring, and a tired reviewer approves things. Using the change on a real address is quicker and closer to what the ticket asked for. The diff is still there for whoever wants it. The cost is a platform that can build a preview for every pull request, which we [built separately](/articles/gitops-deploys-argocd/).

**Self-hosted, end to end.** The tracker, Paseo and the runners for CI all run on our own small cluster; Paseo runs in its own container there. Tickets, code and agent sessions stay with us, and there is no per-seat bill for the tracker. The cost is that we run it all ourselves, on one machine.

**Secrets never go in prompts.** Workers get a brief, with no credentials in it. They use the tools already signed in on the machine, such as GitHub's command-line tool. The runner's own key to the tracker is never printed or copied. That rule is written into the coordinator's standing instructions.

**Memory for preferences.** Agents keep a small set of notes that outlive a session: things the team corrected once and doesn't want to correct again. One says "use bun, not npm, in JavaScript projects, and tell the workers". Another says which git identity to commit with in personal repositories. Each note says why it exists, so it can be questioned later.

## What doesn't work well yet

It works, and it shipped this site. It also has real weak spots.

**Workers can be confidently wrong.** A worker reports "done, tests pass" in the same tone whether it is right or not. The coordinator's review catches a lot, and our own diagram error shows it can catch its own mistakes too. It doesn't catch everything. That is why a person still reviews.

**Review is still the bottleneck.** Agents produce pull requests faster than a person can read them carefully. Previews help, but the most expensive step is still a human paying attention.

**Cost is not tracked.** We know roughly how long each worker ran. We don't yet know what a ticket costs, or whether a cheaper worker that needs two rounds beats a stronger one that needs one.

**Long runs hit timeouts.** A coordinator run has a time limit (two hours for us). Workers belong to Paseo, not to the coordinator, so they keep running if it stops. But someone has to notice. The coordinator is told to report on the ticket what is still running instead of disappearing.

**Briefs still carry the decisions.** Workers can read the ticket, but the ticket doesn't say what the coordinator decided: which part goes to whom, what to leave alone, what counts as done. That lives only in the brief, and a badly written brief still produces a confident, wrong pull request.

**Workers share the coordinator's identity.** In the tracker, workers act as the same agent as the coordinator, with the same permissions. "Read only" is a rule in the brief, not something the tracker enforces. A separate agent identity for workers, limited to reading, would be cleaner, and we haven't set it up.

## How to replicate it

You don't need our setup; the idea carries. Here are the ingredients in the order we would put them together. Each step works before the next is added.

1. **A tracker that agents can use.** You need tickets with acceptance criteria, comments and states, an interface agents can use (we use It's a Plan's MCP server[^2], added once per host as a user-level server in Claude Code, so every worker session gets it with no per-repo setup), and a way to hand a ticket to an agent. It's a Plan queues *agent runs* for that.
2. **A runner.** Something has to pick up those runs and start a command-line coding agent with the ticket. It's a Plan's runner does this: it claims a run, starts the agent in a folder you choose, streams what the agent does back to the ticket, and posts the result.
3. **A coordinator's folder with standing instructions.** The folder the runner starts in is not a repository. It holds a short file of standing orders: you coordinate, workers write code, never edit the owner's checkouts, never print the key.
4. **An orchestrator for workers.** Something has to start agents in fresh worktrees on named branches, let the coordinator wait for them, read their logs, send follow-ups, and clean them up. We use Paseo, and a written skill that teaches the coordinator how.
5. **GitHub and its command-line tool,** signed in on the machine, so workers can push and open pull requests without seeing a token.
6. **CI and preview environments.** Every pull request should get a build and, ideally, a live preview. This is what turns review from reading into trying.
7. **Memory,** last. Once the factory runs, write down what you had to correct, so you don't correct it twice.

::: note 2
MCP, the Model Context Protocol: a standard way for an AI agent to use an outside tool, here the tracker's issues and comments.
:::

A few things to decide up front, because they shape everything later. *Who merges*: we say only people, and we wrote it down. *Branch names*: put the ticket key in them and in every commit, so a change can always be traced back to why. *Which model sits where*: strong for planning and review, cheaper for typing, stronger again for the hard parts. *What the workers may touch*: their own worktree only, and the ticket read-only.

None of the parts are ours. The tracker, the runner, Paseo, Claude Code, git and GitHub are all off the shelf. What we wrote is a page of standing instructions and one skill. The real ones, trimmed, are in the annex.

## Annex: the config that matters

These are real excerpts, trimmed to the lines that carry the ideas above. The instructions, the runner config and the brief template are as written, apart from the redacted key; the rules and the memory note are condensed from longer text.

### The coordinator's standing instructions

This is the whole of the coordinator's `CLAUDE.md`, the file Claude Code reads first in the folder where the runner starts it. It sets the role: coordinate, delegate code, answer questions directly, protect the owner's work and the key.

```coordinator/CLAUDE.md
# Itsaplan runner: coordinator

This folder is where the Itsaplan runner (`@itsaplan/runner`) starts Claude Code for
tickets and chat. It isn't a code repo.

- You coordinate. For any ticket or request that changes code in a repo, open, review or
  fix a PR, use the `paseo-orchestrate` skill. Plan the work, delegate the code to Paseo
  workers (Sonnet 5.5 by default) in their own worktrees, review their diffs, make sure
  the PRs exist, then report on the issue and clean up.
- Don't edit code in `/workspace/<repo>` checkouts yourself. They hold the owner's own
  uncommitted work.
- Answer questions, research, and ticket management (creating, updating, commenting)
  directly, without workers.
- Never print or copy the API key from `itsaplan-runner.json`.
```

### The runner

The runner's configuration. It connects to our tracker as one agent, starts Claude Code on the strongest model in the coordinator's folder, runs up to three tickets at once, and gives each run two hours.

```itsaplan-runner.json
{
  "url": "https://plan.mansus.org/api",
  "apiKey": "<agent key>",
  "agent": "claude",
  "cwd": "/workspace/default",
  "args": ["--model", "opus"],
  "timeoutMs": 7200000,
  "concurrency": 3
}
```

### The worker brief

From the coordinator's orchestration skill. A worker knows nothing about the conversation, so every brief follows this template. It names the ticket, which the worker reads but never changes, and restates the goal, scope and acceptance, so the worker doesn't have to guess what the coordinator decided.

```paseo-orchestrate/SKILL.md (worker prompt template)
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
Final reply: the PR URL, a 2–4 line summary, test results, anything left undone.
```

### The rules of the factory

Also from the skill, gathered in one place. These are the lines that make it behave like a team instead of a script.

```paseo-orchestrate/SKILL.md (excerpts)
- Workers: they have the itsaplan MCP tools (same agent identity as you), so they can
  read the issue, its comments, attachments and linked docs themselves. The ticket stays
  yours: workers only read it. Still put goal, scope and acceptance in the prompt, so
  they don't have to guess what you decided.
- Coordinator: you don't edit code in repos yourself. Even a one-line fix goes to
  a worker. That way every change lands in a worktree and a PR.
- Never edit files in a project's main checkout (/workspace/<repo>). It holds the
  owner's own uncommitted work.
- If what's wanted, or which repo it targets, is unclear, ask in the chat or on
  the issue before you start workers.
- One worker per independent unit. Parts that depend on each other go to the same
  worker, or run one after the other.
- Each worker gets its own branch: <KEY-N>-<slug>.
- Default worker: Sonnet. Use Opus only for a part that's hard or risky.
- Review each worker's diff against the ticket's acceptance criteria. If it falls
  short, send the worker the specific fixes and wait again.
- When the work is complete and checks pass, mark it ready. Leave it as a draft
  when parts are missing or failing.
- Post one comment on the issue: the PR link(s) and one or two plain sentences.
  "completed" when the PR covers the ticket; leave it "started" with what's left.
- Never merge PRs yourself unless the ticket says so explicitly.
- Archive a workspace only after git status is clean and everything is pushed.
  Archiving deletes the worktree directory.
- If you run out of time, report what's still running on the issue rather than
  abandoning it silently.
```

### The tracker tools for workers

Set up once per host, as a user-level MCP server for Claude Code, so every worker session gets the tools. The shape of the entry, with the address and key left as placeholders:

```mcp entry (shape only)
"itsaplan": { "type": "http", "url": "https://<your-itsaplan>/api/mcp",
  "headers": { "Authorization": "Bearer <agent key>" } }
```

### A memory entry

One of the agents' memory notes, with the personal details left out. The note says what to do, why it was written, and when it applies, so a later reader can tell whether it still holds.

```memory/js-package-manager-bun.md
Use bun for JS/TS projects: `bun install`, `bun run dev`, `bun.lock`.
Tell Paseo workers this in their prompts.

Why: the owner corrected a worker prompt that used npm (2026-10-27).
How to apply: any worker prompt or scaffold with a JS frontend says bun
unless the repo already uses something else.
```

## Annex: further reading

The upstream docs for each piece.

- [It's a Plan](https://github.com/croffasia/itsaplan): the open-source tracker with AI agents as team members.
- [It's a Plan runner setup](https://github.com/croffasia/itsaplan/blob/main/docs/runner.md): connecting a command-line coding agent, including Claude Code, as a teammate.
- [The runner package](https://github.com/croffasia/itsaplan/blob/main/packages/runner/README.md): `@itsaplan/runner`, its options and how it claims runs.
- [Agent endpoint protocol](https://github.com/croffasia/itsaplan/blob/main/docs/agent-endpoint.md): the alternative to the runner, where the tracker pushes signed tasks to a URL you run.
- [Self-hosting It's a Plan](https://github.com/croffasia/itsaplan/blob/main/docs/self-hosting.md): running your own instance, and its MCP server.
- [Paseo](https://paseo.sh) and [its source](https://github.com/getpaseo/paseo): running many coding agents at once, in their own workspaces and worktrees.
- [Claude Code](https://code.claude.com/docs/en/overview): the coding agent both the coordinator and the workers run.
- [Claude Code memory and CLAUDE.md](https://code.claude.com/docs/en/memory): standing instructions and memory that persist across sessions.
- [Claude Code skills](https://code.claude.com/docs/en/skills): how a written skill like our orchestration guide is loaded.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents): the built-in way to delegate inside one session, for comparison.
- [git worktree](https://git-scm.com/docs/git-worktree): several working copies of one repository on different branches.
- [GitHub CLI](https://cli.github.com): `gh`, which the workers use to open pull requests.
- [Model Context Protocol](https://modelcontextprotocol.io): the standard the tracker uses to expose its tickets to agents.
- [Archify](https://github.com/tt-a1i/archify): the tool that drew the diagrams.
- [Hyperautomation: GitOps deploys for every repo](/articles/gitops-deploys-argocd/): the platform that builds a preview for every pull request.
