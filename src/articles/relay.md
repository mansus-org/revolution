---
title: "Relay: a micro social network for the people near you"
title_es: "Relay: una microrred social para la gente que tienes cerca"
dek: Relay started as a private room for a few friends. It is now a location-based micro social network. You see what was posted near you, and anyone can join a node from anywhere. Most of it is still being built.
dek_es: Relay empezó como una sala privada para unos pocos amigos. Ahora es una microrred social basada en la ubicación. Ves lo que se publicó cerca de ti y cualquiera puede unirse a un nodo desde cualquier sitio. Casi todo se está construyendo todavía.
summary: Relay pivoted from an invite-only room for friends to a neighbourhood commons. You see posts made within about 10 km of where you are. Planned and in progress, not finished.
summary_es: Relay pasó de una sala solo por invitación a un procomún de barrio. Ves lo publicado a unos 10 km de donde estás. Planeado y en marcha, no terminado.
category: ideology
number: 3
date: 2026-10-26
needs_summary: React Native developers, Python backend help, and people to run a node in their neighbourhood
needs_summary_es: desarrollo en React Native, ayuda con el backend en Python y gente que levante un nodo en su barrio
handover: We are building this slowly, in the time we have. It would go faster with you.
handover_es: Lo estamos construyendo despacio, en el tiempo que tenemos. Contigo iría más rápido.
needs_label: where help would land
needs_label_es: dónde ayudaría
needs:
  - React Native and Expo developers to finish the screens
  - Python and FastAPI help on the node backend
  - People who will run a node for their neighbourhood and tell us what breaks
  - Moderation evaluation on political and everyday text in Portuguese, Spanish and English
  - Writing and design work that keeps jargon off every screen
needs_es:
  - Gente de React Native y Expo para terminar las pantallas
  - Ayuda con Python y FastAPI en el backend del nodo
  - Personas que lleven un nodo para su barrio y nos cuenten qué falla
  - Evaluación de moderación sobre texto político y cotidiano en portugués, español e inglés
  - Textos y diseño que mantengan la jerga fuera de todas las pantallas
---

## What changed

The first Relay was a small private room. A group of four to twenty-nine friends, an invitation link instead of an account, one Go program on one computer, and every post a static page. We still like most of the ideas in it: no feed algorithm, no counts, a server that belongs to a person and not to a company.

We stopped short of recommending it, because it was missing the one thing we kept wishing for. Our friends were not the ones missing from our lives. The people missing were the ones on our own street.

So Relay has pivoted. Relay 2.0 is a location-based micro social network. It is a plan and a work in progress, and this article says which parts are which.

## What goes wrong in the big rooms

Local community has eroded, and we do not think that is an accident of taste. There is no low-friction digital commons for a neighbourhood. The big platforms are built to reach everyone, so a post about a lost cat, a Sunday market or a broken lift competes with the whole planet and loses. Neighbourhood groups end up in chat apps, where nothing can be found a week later, or in feeds tuned for attention, where the useful things sink.

Three things go wrong when a place lives inside a platform.

The first is ownership. The memory of the place belongs to a company that can change the rules, count everyone, or close the door.

The second is moderation. One set of rules, written far away, for people who will never meet the writers. A neighbourhood cannot set its own.

The third is decay. Platforms change shape to keep growing, and the feed starts showing things nobody near you posted.

## The one rule

::: note 1
The exact figures, the privacy rules and what the server does with them are in the companion piece on the locality model.
:::

You only see posts that were created within about 10 km of where you are now. Your posts are only visible to people who are currently within about 10 km of where you posted.[^1] That is the whole product idea. There is no global feed, no follower graph to climb and no trending page, because the unit is a place and not a person.

Locality belongs to the post, not to the account. You can post from one city today and from another next week, and each post reaches the people near where it was made. A post is tied to a real physical moment: you cannot post "from" a neighbourhood you are not in.

::: pull
Location shapes visibility, not membership.
:::

## Anyone can join, from anywhere

The old Relay was invite-only. The new one is open by default: anyone can join a node from anywhere in the world. Where you are decides what you can see and who can see you, not whether you may belong. Someone on holiday keeps their node and sees the beach town while they are in it.

Open doors invite spam, and we know it. Invite-only remains as a setting for closed circles that want it. For the open case, nodes will be able to screen posts with a small moderation model; that is described in the article on the app and moderation, and it is planned, not built.

## Who it is for, and who it is not

Relay is for the neighbourhood that wants somewhere to put things: a market on Sunday, a question about the metro line, a poster for a show, an event on the corner. It works best when someone local is comfortable running a node, or willing to learn how.

It is not for reaching an audience. There is no way to broadcast beyond your radius, which is deliberate. It does not hide you from whoever runs the node you are on, who can see what the server stores. It is not a safe place to say things that must stay secret. And it will only be as good as the people near you who show up, which at the start is nobody.

## How it is built

::: figure Fig. 1
![The Relay feed in the Expo app mockup, headed Pinheiros 10 km](/articles/images/relay-app-feed.png){colour}
The feed from the mobile mockups: what was posted within 10 km of where you are, newest first. Mockups, not the shipped app.
:::

A phone is where location lives, so the main client is a mobile app, built with Expo and React Native for iOS and Android from one codebase. The app is a design and a work in progress: the mockups of about thirty screens are done, the Expo project is set up and the screens are being built. There is a second article on the app.

Behind it, each node is one server that you or someone near you runs. We rewrote the backend from Go to Python with FastAPI, with SQLite by default, Postgres as an option, JWT auth, and one Docker image. That rewrite is in progress. One app talks to any node, so there is nothing to build per neighbourhood.

## The IndieWeb got the values right

Relay did not invent the idea that people should own what they publish. The [IndieWeb](https://indieweb.org/) has argued it for years, with [Webmention](https://indieweb.org/Webmention), [Micropub](https://indieweb.org/Micropub) and [POSSE](https://indieweb.org/POSSE). We agree with nearly all of it. The first Relay planned an IndieWeb bridge; the pivot puts that on hold, because the first job is to make a node that a neighbourhood can use without learning any of those words.

## Where it sits among the others

| Network | Who runs it | The unit |
| --- | --- | --- |
| [Mastodon](https://joinmastodon.org/) / ActivityPub | Many operators, one protocol | An account, public timelines |
| [Nostr](https://github.com/nostr-protocol/nostr) | Nobody: anyone's relays | A key, many relays |
| Neighbourhood chat groups | A phone number's owner | One group, no search |
| Relay | Someone near you | A place and a moment |

Mastodon shares the instinct that a server should belong to people and not to a platform, and then builds a public network with handles. Nostr's relays are interchangeable stores for strangers' messages. A Relay node is closer to a noticeboard that follows you around.

## What works and what does not, yet

Planned and in progress: everything in this article. The mobile mockups exist. The Expo project is set up. The Python backend is being rewritten. The locality feed and open membership are specified. AI moderation is planned, with a spike to measure how it behaves on political text before anything ships.

Not built: a finished app, a node you can point a friend at, and any of the moderation. We would rather say that than have you find out.

## How to help

We are working on Relay in the time we have, and that time is not much. The most useful help is people who can finish the app and the backend, and above all people who would run a node for their own neighbourhood and tell us what breaks.

The code is at [github.com/mansus-org/relay](https://github.com/mansus-org/relay); it does not have a licence file yet, so it is not open source in the formal sense. Open an issue there for anything about Relay itself, or on [this site's repository](https://github.com/mansus-org/revolution/issues) to talk about the idea. We read both.
