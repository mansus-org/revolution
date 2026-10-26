---
title: "Relay: a micro-social network you run yourselves"
title_es: "Relay: una microrred social que lleváis vosotros mismos"
dek: The things a group of friends shares end up on someone else's computer, under someone else's rules. Relay is one program, one host, and an invitation link instead of an account.
dek_es: Lo que comparte un grupo de amigos acaba en el ordenador de otro, con las reglas de otro. Relay es un programa, una persona que lo aloja y un enlace de invitación en lugar de una cuenta.
summary: One program, one host, and an invitation link instead of an account. No feed algorithm, no counts, no company in the middle.
summary_es: Un programa, una persona que lo aloja y un enlace de invitación en lugar de una cuenta. Sin algoritmo, sin contadores, sin empresa en medio.
category: ideology
number: 3
date: 2026-10-26
needs_summary: groups willing to host a node and tell us what breaks
needs_summary_es: grupos dispuestos a alojar un nodo y contarnos qué falla
handover: We are building this slowly, in the time we have. It would go faster with you.
handover_es: Lo estamos construyendo despacio, en el tiempo que tenemos. Contigo iría más rápido.
needs_label: where help would land
needs_label_es: dónde ayudaría
needs:
  - A group that runs a node for a month and reports what breaks
  - Go work on host operations, backup, export and invite expiry
  - Someone who knows Webmention and Micropub, for the interchange layer
  - Writing and design work that keeps jargon off every screen
needs_es:
  - Un grupo que tenga un nodo un mes y nos cuente qué falla
  - Trabajo en Go para la operación del nodo, copias, exportación y caducidad de invitaciones
  - Alguien que conozca Webmention y Micropub, para la capa de intercambio
  - Textos y diseño que mantengan la jerga fuera de todas las pantallas
---

## What goes wrong in the big rooms

A group of friends shares a lot. Photos from a weekend, a link worth reading, a poster for a show, a long message someone clearly spent an evening on. Most of it lands in products. The photos are in one app, the links in another, the long writing somewhere else, and the group's memory belongs to a company that can change the rules, count everyone, or close the door.

We think three things go wrong when a group lives inside a platform.

The first is ownership. The pictures and the words are yours in a legal sense and theirs in every practical one. You can export, sometimes, into a zip file nobody opens. The address of the thing you made belongs to the company, and so does the decision about whether it is still there next year.

The second is moderation. A platform with a very large number of users needs one set of rules for all of them, written by people who have never met any of them and enforced at a scale where mistakes are a statistic. A small group has no say in those rules. It also cannot set its own, because the room is shared with everyone else.

The third is decay. Platforms change shape to keep growing. The feed starts showing things nobody in the group posted, the counts start mattering, the features the group relied on get moved or removed. None of it is malicious. It is what a business that needs more attention every quarter does to the place where you keep your memories.

## Small on purpose

Relay is our answer, and it starts from two constraints we do not intend to relax.

**Micro.** A Relay node is for a group of roughly 4 to 29 people. Not a community, not an audience: the people you would actually invite to dinner, plus the ones they vouch for. Inside that size, moderation stops being a policy problem and becomes a conversation among people who know each other.

**Run yourselves.** A node is one Go program and one folder of data on a computer that someone in the group keeps. There is no database to set up, no external service, no company account. The host is not a moderator by default. They are the person with the keys to the server, the way someone in a group of friends is the person with the car.

::: note 1
Revocation follows the invitation tree. If the host revokes Alice, the people Alice invited lose their links too, and the people they invited. The host can re-invite anyone who should stay.
:::

There is no sign-up. People join through an invitation link, and the link is the account. There is nothing to remember and nothing to recover: no email, no password, no reset form. Any member can invite someone they trust, so the group grows by vouching, and removing someone removes the branch they brought in.[^1] The cost is real and we say it plainly: whoever holds the link is the member, so a link has to be treated like a password.

## What is not there

Relay's home page lists what everyone shared, newest first. That is the whole ordering. There is no feed algorithm deciding what you see, because there is nothing to optimise: no ads to place, no time-on-site to grow, no company in the middle that needs either.

There are no follower counts, no likes and no reposts. Each member has a page listing what they shared, and friends talk in comments under a post. If you want to pass something on, you make your own post about it and link to it, which is slower than pressing a button and is meant to be.

Every post is a small static website at an ordinary address under the node: a page of writing, a gallery, a link with a preview, an event, a few songs. Eleven templates cover the common kinds without a build step. Because posts are plain files, you can back them up, link to them from anywhere, and take them with you if the group ever moves.

::: pull
Everyone else answers "who are you?" with a domain, an account or a key. Relay answers with an invitation.
:::

## Who it is for, and who it is not

Relay is for the group chat that wants somewhere to put things. A group of friends, a small collective, a family, a band and the people around it. It works best when one person in the group is comfortable keeping a small server running, or is willing to learn.

It is not for reaching strangers. There is no directory, no discovery page, no trending list and no way to browse other people's nodes. If you want an audience, a public blog or a Mastodon account will serve you better. It is not for large communities either: past a few dozen people the room stops being a room. It does not hide you from the host, who can see everything on the machine they keep. And it is not for groups where nobody wants to run anything at all. Someone has to keep the computer on.

## The IndieWeb got the values right

Relay did not invent the idea that people should own what they publish. The [IndieWeb](https://indieweb.org/) has argued it for years, and has built the standards to go with it:

- own your domain, so your address cannot be taken from you;
- [Webmention](https://indieweb.org/Webmention), so a reply on one site can notify the post it replies to on another;
- [Micropub](https://indieweb.org/Micropub), so any compatible app can publish to your site;
- [IndieAuth](https://indieweb.org/IndieAuth), so your website address can be your login;
- [POSSE](https://indieweb.org/POSSE): publish on your own site first, then post copies elsewhere that link back to the original.

We agree with nearly all of it. The question we kept coming back to is why so few people live this way. Our list:

1. Onboarding is hard. A domain, hosting and the right plugins is a weekend project, not a thirty-second sign-up.
2. There is no network effect. A platform hands you an audience. The IndieWeb hands you freedom and an empty room you have to fill and promote yourself.
3. The jargon filters people out. Microformats, Webmention and POSSE are precise words, and they tell a newcomer this is not for them.
4. There is no killer app. Mastodon became the friendly face of ActivityPub. The IndieWeb has no equivalent most people would recognise.
5. The loops are weak. Replies and likes between sites take manual plumbing, and finding people is hard.
6. It is a philosophy more than a product. That attracts people who already agree and rarely anyone else.

## How Relay tries to close the gap

Relay does not try to fix the whole IndieWeb. It cannot give everyone their own domain and a public stage, and it should not try. It goes after the gaps a group can close.

Onboarding is one command on the host's machine, or one container. Members never touch a server; they open a link. The empty room is not empty, because the audience is the group that is already there. The jargon stays off the screen: the plan is to say "share to Mastodon" rather than POSSE, and "replies from the web" rather than Webmention.

```keep a node
curl --proto '=https' --tlsv1.2 -sSfL \
  https://raw.githubusercontent.com/nemoNoboru/relay/main/install.sh | sh

relay node --name my-group --data /var/lib/relay --listen :8080
```

::: note 2
Everything in this section after the install command is a design note in the repository, not shipped behaviour.
:::

The connection to the wider web is planned in four steps, cheapest first.[^2] First, feeds and microformats markup, so any IndieWeb tool can read a node. Then receiving Webmentions, so a reply from elsewhere can appear under a post as a moderated comment. Then Micropub and IndieAuth, using each member's profile address as their identity, so standard apps can post to the node. Last, posting copies out to Mastodon or Bluesky that link back to the original. Through all of it the shape stays the same: one node, one group, an invitation as the door. We would rather be a good on-ramp for groups than a weaker version of a personal blog.

## Where it sits among the others

There are good projects close to this one, and the differences are the point.

| Network | Who runs it | Who you are | The unit |
| --- | --- | --- | --- |
| [Mastodon](https://joinmastodon.org/) / ActivityPub | Many operators, one protocol | An account on someone's instance | One account, public timelines |
| [Micro.blog](https://micro.blog/) | A hosted service, or yourself | Your own domain | One person, one public site |
| [WriteFreely](https://writefreely.org/) | Yourself, or a hosted flagship | An account on an instance | One writer, one blog |
| [Nostr](https://github.com/nostr-protocol/nostr) | Nobody: anyone's relays | A cryptographic key | One key, many relays |
| [Scuttlebutt](https://scuttlebutt.nz/) | Everyone: peer to peer | A cryptographic key | One key, a local log |
| Relay | One person in the group | An invitation link | One group, one node |

Micro.blog is the closest in spirit: no counts, no trending, small by design. The difference is that it gives one person a public site, and Relay gives a group a private room. Mastodon shares the instinct that a server should belong to a person rather than a platform, and then builds a public network with handles on domains you do not own. Nostr's relays are interchangeable stores for strangers' messages; a Relay node is a room for people you know, which makes the shared name a little unlucky. Scuttlebutt asks every friend to run something and spreads the group's data across everyone's logs. Relay asks one friend to run one program and keeps the group's data in one folder anyone can back up. Each choice buys something. Ours buys a five-minute setup and a clear guest list, and costs trusting one host.

## What works and what does not, yet

Built and working: invitation links with delegated invites and cascade revoke, a host console, a welcome page for new members, the chronological home and profile pages, comments with host moderation, publishing from the browser or the command line, the eleven templates, re-hosting a video or a page from a link, keeping the last ten versions of every post with rollback, and HTTPS.

Not built yet: the host operations a node needs before we would recommend it to people who are not us. Backup and export, invitation expiry, limits, and better moderation tools. The IndieWeb work above is design, not code.

## How to help

We started Relay because we wanted it for our own friends, and we keep working on it in the time we have. That time is not much. If you want this to exist sooner, there are concrete ways in.

The most useful thing is a group that runs a node for a month and tells us what broke and what confused them. You need one person who can keep a small Linux machine or a container online; nobody else needs anything but the link. After that, the work is mostly Go for the host operations, someone who knows Webmention and Micropub for the interchange layer, and careful writing and design so none of it ever shows up as jargon.

The code is at [github.com/nemoNoboru/relay](https://github.com/nemoNoboru/relay). Open an issue there for anything about Relay itself, or on [this site's repository](https://github.com/nemoNoboru/revolution/issues) to talk about the idea. We read both.
