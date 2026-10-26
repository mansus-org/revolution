---
title: "The Relay app: a poster in your pocket, and a bouncer that reads"
title_es: "La app de Relay: un cartel en el bolsillo y un portero que lee"
dek: The mobile app, one codebase for every node, drawn like a Constructivist poster, and the planned AI moderation that keeps an open node from filling with spam.
dek_es: La app móvil, un único código para todos los nodos, dibujada como un cartel constructivista, y la moderación con IA planeada para que un nodo abierto no se llene de spam.
summary: Expo and React Native mockups of about thirty screens, one app for any node, and a planned decision model that screens posts. Mockups and plans, not a shipped app.
summary_es: Mockups en Expo y React Native de unas treinta pantallas, una app para cualquier nodo y un modelo de decisión planeado que filtra publicaciones. Mockups y planes, no una app terminada.
category: architecture
number: 5
date: 2026-10-26
needs_summary: React Native and Expo developers, and people to evaluate moderation in three languages
needs_summary_es: gente de React Native y Expo, y quien evalúe la moderación en tres idiomas
needs_label: where help would land
needs_label_es: dónde ayudaría
needs:
  - React Native and Expo developers to build the remaining screens
  - Someone to wire live updates over SSE and the map view
  - People who can build a test set of political and everyday posts in Portuguese, Spanish and English for the moderation spike
  - A Python developer to build the moderation sidecar behind a switch
  - Accessibility testing of the poster-style design on real phones
needs_es:
  - Gente de React Native y Expo para construir las pantallas que faltan
  - Alguien que conecte las actualizaciones en vivo por SSE y la vista de mapa
  - Personas que armen un conjunto de prueba de publicaciones políticas y cotidianas en portugués, español e inglés para el experimento de moderación
  - Una persona de Python para construir el servicio de moderación detrás de un interruptor
  - Pruebas de accesibilidad del diseño tipo cartel en móviles reales
---

## A phone feature

Relay's [locality model](/articles/relay-locality/) depends on knowing, roughly, where you are, so the main client is a phone app. We are building it with Expo and React Native, which gives iOS and Android from one codebase.

Status, plainly: mockups of about thirty screens are done, the Expo project is set up, and the screens themselves are in progress. The pictures below are the mockups, not screenshots of a shipped app.

::: gallery Fig. 1
![Feed, headed Pinheiros 10 km](/articles/images/relay-app-feed.png)
![Compose, with a location chip](/articles/images/relay-app-compose.png)
![Communities nearby](/articles/images/relay-app-communities.png)
![Events, map view](/articles/images/relay-app-events-map.png)
Four of the mockups: the feed, composing a post with a location chip, communities in range sorted by distance, and events on a map. Real colours; the rest of this site is dithered on purpose.
:::

## What is in it

Four tabs: Feed, Communities, Events and Settings, with a floating "+" to compose.

- **Feed.** Posts from within the node's radius, with threaded replies three levels deep, reactions, and live updates over server-sent events.
- **Communities.** Nearby communities sorted by distance. You join with an optional pseudonym, or create one with a location and a radius.
- **Events.** A list and a map toggle, pins on the map, and RSVP.
- **Settings.** Including the server switcher, below.
- **Admin.** A moderation queue for whoever runs the node.

::: figure Fig. 2
![Reading a thread: replies nested under a post](/articles/images/relay-app-thread.png){colour}
A thread. Replies stop at three levels, so a conversation stays readable on a narrow screen.
:::

## One app, any node

Settings has a server URL field. Point it at a node and the app talks to that node; point it somewhere else and it talks there. The default is `relay.mansus.org`. There is no per-node build, so a neighbourhood that starts a node does not need to publish an app or ask anyone's permission.

::: gallery Fig. 3
![Settings: server switcher](/articles/images/relay-app-server-switcher.png)
![Admin moderation queue](/articles/images/relay-app-moderation-queue.png)
![Feed with location off](/articles/images/relay-app-location-off.png)
The server switcher, the moderation queue a node's admin would see, and the feed when location is off, which asks you to enable it rather than showing a global list.
:::

## How it looks

The visual design is a Constructivist and Bauhaus poster: cream paper, ink black, signal red and ochre, square corners, thick borders, hard offset shadows and huge condensed headlines. It is a different look from the dithered pages of this site, but it comes from the same place: a screen should look like something someone made.

## The bouncer

::: note 1
A decision model is trained to answer a question about a text, like "is this spam?". It does not write text back, which is why it is small and fast.
:::

Open membership invites spam. Anyone can join a node from anywhere, so a node needs a way to screen what comes in. This part is planned. Nothing here is built yet.

The idea is to use small decision models, such as Laya or SemIf/OpenJev, rather than a text-generating LLM.[^1] A model like that does a single forward pass and returns a yes, a no or a score. It runs on a CPU and can be self-hosted as a sidecar next to the node.

The policy is a plain-text list of questions: "is this an advert for something unrelated to the community?" and so on. The operator edits the list without redeploying. A post that scores badly goes to the moderation queue in the app.

Two safety choices are fixed in the plan. Moderation is switched by `MODERATION_ENABLED`; when it is `false`, posts go live immediately. And it fails open: if the sidecar is down, posts go through, so a crashed container never silences a neighbourhood.

## The risk we are watching

The risk is false positives on political content. A model that quietly hides a post about a council vote is worse than spam. So before anything ships, a spike will measure how the models behave on political text, in Portuguese, Spanish and English. If the numbers are bad, we will say so and not ship it.

## The backend, briefly

The node server has been rewritten from Go to Python with FastAPI, with SQLite by default, Postgres as an option, JWT authentication and one Docker image. This is in progress.

## How to help

React Native and Expo developers are the clearest need: the screens are the biggest piece of work left. After that, people who can help evaluate moderation on real posts in three languages, and anyone who would run a node. The code is at [github.com/nemoNoboru/relay](https://github.com/nemoNoboru/relay). It has no licence file yet, so we do not call it open source. Open an issue on [this site's repository](https://github.com/nemoNoboru/revolution/issues) to talk to us.
