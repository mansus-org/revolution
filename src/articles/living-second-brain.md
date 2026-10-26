---
title: "The living second brain: Obsidian and AI agents that remember"
title_es: "El segundo cerebro vivo: Obsidian y agentes de IA que recuerdan"
dek: One folder of markdown notes as shared long-term memory for people and AI agents, where the agents also write and refine their own skills. Planned, being designed, not built yet.
dek_es: Una carpeta de notas en markdown como memoria a largo plazo compartida entre personas y agentes de IA, donde los agentes también escriben y mejoran sus propias habilidades. Planeado, en diseño, aún sin construir.
summary: A vault of plain notes that people and agents both read and write, with a memory protocol and agents that write their own skills.
summary_es: Una bóveda de notas que leen y escriben personas y agentes, con un protocolo de memoria y agentes que escriben sus propias habilidades.
category: architecture
number: 1
date: 2026-10-12
needs_summary: people who have tried agent memory and can tell us where it broke
needs_summary_es: gente que haya probado memoria para agentes y sepa dónde falló
needs_label: to turn the design into something others can use
needs_label_es: para convertir el diseño en algo que otros puedan usar
needs:
  - Experience running AI agents through MCP, day to day
  - Opinions on note schemas that survived more than a year of use
  - Ideas for evaluating whether recall actually improved
  - Someone who would want to ship this as a product
needs_es:
  - Experiencia usando agentes de IA con MCP a diario
  - Opiniones sobre esquemas de notas que hayan sobrevivido más de un año
  - Ideas para medir si el recuerdo mejora de verdad
  - Alguien que quiera sacarlo como producto
---

## Why assistant memory keeps failing

Anyone who works with AI agents every day knows the pattern. You spend an hour explaining how a project is laid out, which decisions were already made and why, and what the user cares about. The session ends. The next one starts from nothing, and you explain it again.

We think the failure has four parts.

- **Context windows are not memory.** A long context lets an agent hold a lot for one session. It does not carry anything to the next one.
- **There is no persistence by default.** What an agent learns lives in a conversation that ends, or in a memory feature the vendor controls and you cannot inspect.
- **There is no structure.** Where memory exists, it is usually a pile of remembered sentences with no types, no links and no way to say that one fact replaced another.
- **It is opaque to the human.** You cannot open the agent's memory, read it, correct it, or delete the one wrong assumption that keeps coming back.

## A vault both sides can read

Our idea is to put the memory somewhere both people and agents already know how to use: an [Obsidian](https://obsidian.md/) vault. A vault is a folder of markdown files. People read and edit it in a good editor, with links between notes, search and a graph. Agents can read and write the same files. Nothing is hidden in a vendor database, and every note is a plain text file you can open with anything.

The vault becomes shared long-term memory: facts about people and projects, decisions and the reasons for them, what happened in each session. It also becomes the place where agents keep their skills, the written-down procedures they follow, and where they improve them over time.

## The read and write layer is solved

::: note 1
The [Model Context Protocol](https://modelcontextprotocol.io/) is an open protocol for connecting AI models to tools and data sources. An MCP server exposes a set of tools an agent can call.
:::

We do not need to build plumbing. The [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin exposes a vault over an authenticated HTTPS API on the local machine, and an MCP server in front of it lets an agent search, read, create and patch notes.[^1] That part works today.

The real work is everything above it: what goes where, which fields a note carries, and when an agent reads and writes. Without those rules, a vault that agents write to turns into a second junk drawer within a week.

## The schema

A fixed folder layout, so both sides know where things live:

```vault layout
vault/
  inbox/          agent writes it is not sure about, waiting for a person
  people/         one note per person
  projects/       one note per project, linking to its decisions
  decisions/      what was decided, when, and why
  sessions/       one note per agent session, written at the end
  skills/         procedures the agents wrote for themselves
  changelog.md    one line per agent edit, newest first
```

Every note type has its own front matter, so an agent can query by field instead of guessing from prose. A decision carries its date, its project and what it replaced. A session note carries the agent, the task and the notes it touched. A skill carries its name, version, trigger and the date it last changed:

```skills/review-a-pull-request.md
---
type: skill
name: review-a-pull-request
version: 4
trigger: user asks for a review of a PR or a diff
last_updated: 2026-10-12
---
```

## The memory protocol

The schema says where things go. The protocol says when an agent touches them.

1. **At the start of a session**, the agent searches the vault for the task at hand and reads what it finds: the project note, the recent decisions, the last session on the same work.
2. **During the session**, it follows links from those notes rather than loading everything. A project note points to its decisions; a decision points to the people involved.
3. **At the end of a session**, it writes a session note and updates the notes it learned something about.
4. **When it is not sure**, it writes to the inbox instead of editing a note directly. A person accepts, edits or deletes it.
5. **Every agent edit** gets one line in the changelog, so a person can see in a minute what changed since yesterday.

The other direction matters just as much. When a person edits a note, fixes a wrong fact, renames a project, the next agent session picks that up through the same search. The human never has to tell the agent separately. Editing the note is telling it.

::: pull
Editing the note is telling the agent. Nothing needs to be explained twice.
:::

## Molting: agents that write their own skills

The part we find most interesting is skills. An agent that does the same kind of task repeatedly should not rediscover the procedure every time. It should write it down, and then keep improving what it wrote. We call that molting: the skill sheds an old version and grows a better one.

::: note 2
A "dream" pass is the name used in open-second-brain for a similar consolidation step. We borrowed the word because it fits.
:::

A skill is a note in `skills/`, written by an agent, in plain language, with the front matter above. Three things trigger a molt: the agent notices it has done the same thing several times, a new constraint appears that the old skill does not handle, or a person corrects it. The agent then edits the skill, bumps its version and records why.

Left alone, that produces a lot of overlapping skills. So a periodic consolidation pass, which we call the dream pass,[^2] reads the whole `skills/` folder, merges duplicates, prunes skills nobody has triggered in a long time, and bumps versions where it changed something. Every one of these edits is audited, either as a new version of the note or as a git commit on the vault, so any change can be read, questioned and reverted.

## What others have tried

We are not the first to put agents and notes together, and we have been reading the projects that did. Second-brain-os, open-second-brain (where we found the dream pass) and ai-memory-vault each take a piece of this. What we have not found is the combination: a typed schema, an explicit memory protocol with an inbox and a changelog, and agents that maintain their own skills under audit, all in a vault a person keeps using every day.

## Where we are

To be clear about the status: this is planned and being designed. It is not built. The read and write layer exists and works; the schema and the protocol are what we are writing down now.

Next, we want to run the protocol by hand for a few weeks: write the session notes, use the inbox, keep the changelog, and see which parts survive real use. After that, a first version of the molt and dream passes, with every change committed to git so we can read exactly what the agents did to their own skills.

Things we do not know yet:

- whether search plus link traversal finds the right notes often enough, or whether we need embeddings;
- how many skills a vault can hold before the dream pass stops keeping them tidy;
- how to tell, with evidence, that the agents actually remember better rather than just writing more;
- how much of this survives a change of model or vendor.

## Could someone else ship this?

We think there is a product here. We suspect many people who use AI agents for real work have hit the same memory wall, and plenty of them already keep notes in markdown. A tool that installed the schema, the protocol and the passes into an existing vault, and made the agents' memory something you can read and correct, would be useful to a lot of people.

We are not going to build that product. If you have run agents with MCP for real work, have a note schema that survived years, or want to turn this into something people can install, open an issue on [this site's repository](https://github.com/nemoNoboru/revolution/issues). We will share the design notes as they are and tell you what we learned from running them.
