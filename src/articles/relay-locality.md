---
title: "Relay's locality model: seen where it was made"
title_es: "El modelo de localidad de Relay: visto donde se hizo"
dek: How a post reaches only the people near where it was written, what the phone tells the server, and what it never does. A design, partly built.
dek_es: Cómo una publicación llega solo a la gente cercana al lugar donde se escribió, qué le cuenta el móvil al servidor y qué no hace nunca. Un diseño, en parte construido.
summary: Posts are visible within about 10 km of where they were made. The phone sends a coarse cell, not an address, and your own location is never stored.
summary_es: Las publicaciones se ven a unos 10 km de donde se hicieron. El móvil envía una celda gruesa, no una dirección, y tu ubicación nunca se guarda.
category: architecture
number: 4
date: 2026-10-26
needs_summary: backend developers, and privacy reviewers who will try to break it
needs_summary_es: desarrollo de backend y gente de privacidad que intente romperlo
needs_label: where help would land
needs_label_es: dónde ayudaría
needs:
  - Python and FastAPI developers to finish the bounding box and haversine query
  - A privacy review of the geohash cell size and the no-logging claim
  - People to run a node and report what the 10 km default feels like in a city and in a village
  - Tests for edge cases: the date line, the poles, a fast-moving phone
needs_es:
  - Gente de Python y FastAPI para terminar la consulta de caja delimitadora y haversine
  - Una revisión de privacidad del tamaño de celda geohash y de la promesa de no registrar
  - Personas que lleven un nodo y cuenten cómo se siente el radio de 10 km en una ciudad y en un pueblo
  - Pruebas de casos límite: la línea de fecha, los polos, un móvil en movimiento
---

## One rule, two directions

Relay 2.0 is [a location-based micro social network](/articles/relay/). The rule fits in a sentence, and it points both ways. You only see posts created within about 10 km of where you are now. Your posts are only visible to people currently within about 10 km of where you posted.

That is all the model needs. Everything in this article is how to make it true without turning the server into a map of where everyone has been.

## Per post, not per account

Locality attaches to the post. There is no "home city" on your profile. Post from one city today and another next week, and each post reaches the people near where it was made. Someone travelling reads the place they are in, and their old neighbourhood keeps what they left there.

It also means a post is tied to a physical moment. You cannot post "from" a neighbourhood you are not in, because the phone supplies the location at the time of writing. We call that honest rather than secure: someone determined can spoof a phone. The goal is that ordinary use cannot lie by accident.

## What the phone sends

::: note 1
A geohash splits the world into a grid of cells, and a longer code names a smaller cell. Precision 6 is a cell of roughly 1.2 by 0.6 km.
:::

The client does not send your coordinates. It snaps the GPS reading to a coarse [geohash](https://en.wikipedia.org/wiki/Geohash) cell at precision 6, about 1.2 by 0.6 km.[^1] A post therefore says "the neighbourhood", not "the street address". The server never receives anything sharper, so it cannot leak anything sharper.

Location is opt-in per post. If you attach no cell, the post is private to the node and appears in no locality feed. It is a different kind of post, not an error.

## What the viewer sends

To read, your phone sends where you are as a query parameter on that request. It is a per-request parameter. It is never stored and never logged. The server uses it to answer and forgets it. We say this as a design rule and we want it reviewed, because it is the claim that matters most.

## How the server answers

No spatial database is needed. The server works out a bounding box around the viewer, filters posts whose cell falls in it, and then checks the exact distance with the haversine formula. That keeps the whole thing in SQLite, which is the default, or in Postgres without PostGIS. The radius is a per-node setting, `LOCALITY_RADIUS_KM`, with a default of 10.

```the idea in Python
box = bounding_box(viewer, radius_km)
near = [p for p in posts_in(box) if haversine(viewer, p.cell_center) <= radius_km]
```

That snippet is a sketch of the approach, not code from the repository.

## Open membership

Joining is separate from seeing. Anyone can join a node from anywhere: location shapes visibility, not membership. A node can be set with `ACCESS_MODE=open` or `ACCESS_MODE=invite_only`, and invite-only stays for closed circles.

## Why bother

Local community has eroded, and there is no low-friction digital commons to replace it. A rule this blunt gives a street its own channel without asking anyone to follow anyone. It also makes a good constraint: a post that cannot travel cannot go viral, so there is nothing to optimise for.

## What is built, what is not

Specified: the feed rules, the cell precision, the per-request viewer location, open and invite-only membership. In progress: the Python backend that will implement the query. Not built: the shipped app. The privacy claims above are design intent and need an outside review before anyone should rely on them.

Relay has no licence file yet, so we do not call it open source. The repository is at [github.com/mansus-org/relay](https://github.com/mansus-org/relay). Issues about the idea can go to [this site's repository](https://github.com/mansus-org/revolution/issues).
