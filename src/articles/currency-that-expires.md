---
title: A currency that expires every winter
title_es: Una moneda que caduca cada invierno
dek: Money that loses a little each month and turns into firewood on the shortest day. Notes for a town that wants to try it for one year.
dek_es: Dinero que pierde un poco cada mes y se convierte en leña el día más corto del año. Notas para un pueblo que quiera probarlo durante un año.
category: ideas
number: 8
date: 2026-10-19
reading_time: 9
sample: true
needs_summary: a town willing to run it for one year
needs_summary_es: un pueblo dispuesto a probarlo un año
needs_label: before anything is printed
needs_label_es: antes de imprimir nada
needs:
  - A council willing to run it for one season
  - A local bank to hold the backing
  - A printer who can number notes
  - Someone to keep the stamp ledger for ten months
needs_es:
  - Un ayuntamiento dispuesto a probarlo una temporada
  - Un banco local que guarde el respaldo
  - Una imprenta que sepa numerar billetes
  - Alguien que lleve el registro de sellos diez meses
---

## The problem with money that keeps

Most money in a small town does not stay there. It comes in as wages or pensions, sits in an account for a while, and leaves through a supermarket chain, an energy company, or a landlord who lives somewhere else. Economists have names for this. We mostly noticed it on the high street: the shops that close are not the ones nobody used, they are the ones where the money passed through too quickly to stick.

There is a second, quieter problem. Money that keeps its value is safe to hold, so people hold it, especially when things look uncertain. That is sensible for a household and bad for a town. A euro kept in a drawer through a slow winter is a euro that didn't pay for a repair, a meal out or a music lesson. Nobody did anything wrong. The money stopped moving at the moment the town most needed it to move.

This piece is about a local currency designed to do the opposite. It loses value if you keep it, and on the shortest day of the year whatever is left stops being money and becomes heat for buildings everyone uses. We have argued about it for most of a year and we still think it is worth trying. We are not going to try it ourselves.

## How a winter note works

::: note 1
South of the equator the year runs the other way: issue in September, expire on 21 June. We have only thought it through for the north.
:::

The short version: a town prints its own notes in spring, they can be spent alongside euros in local shops, they need a stamp every month to stay valid, and they all expire on 21 December.[^1]

1. In March, the council issues winter notes in exchange for euros, one for one. The euros go into a locked account at a local bank, so every note in circulation is backed.
2. Shops, cafés, the market and the council itself accept the notes at face value. Shops can pay suppliers and staff with them, as long as those people are local too.
3. On the first of every month, each note needs a stamp to stay valid. A stamp costs 2% of the face value and is sold at the town hall and at any shop that takes the notes.
4. Anyone can swap notes back to euros at any time, at 95% of face value. The 5% stays in the fund.
5. On 21 December, all notes expire. The euros still backing them move into the town's heating fund.

Step four matters more than it looks. Without it the notes are a trap, and people who are wary of traps don't take part. With it, the worst that can happen to you is a small loss you agreed to in advance. The exit is there to make it safe to go in.

### The stamp

::: note 2
Nine boxes are needed and twelve are printed. The spares exist because someone always stamps the wrong one.
:::

The stamp is the part people find strangest, and it is the oldest part of the idea. Each note carries twelve printed boxes, one for each month from April to December plus spares.[^2] A note without the current month's stamp is still yours, but no shop has to accept it until you stamp it. Holding money costs a little, and you can see the cost on the paper.

::: figure Fig. 1
A winter note in late October, eight boxes stamped. Placeholder drawn and dithered on the page; the real figure will be a print proof.
:::

A shop that takes in notes on the 28th has three days to spend them or pay the stamp. That is a burden for the shop, a small one. In practice it pushes shops to pay local suppliers in notes rather than converting, which is the point. Here is what holding a single 10-unit note costs if you never spend it:

<div class="table-wrap">
<table>
<caption>One 10-unit note, held from March to the end</caption>
<thead>
<tr><th scope="col">Date</th><th scope="col" class="num">Stamp</th><th scope="col" class="num">Paid so far</th><th scope="col">What the note is worth</th></tr>
</thead>
<tbody>
<tr><td>1 March</td><td class="num">none</td><td class="num">0.00</td><td>10.00, issued</td></tr>
<tr><td>1 April</td><td class="num">0.20</td><td class="num">0.20</td><td>10.00</td></tr>
<tr><td>1 June</td><td class="num">0.20</td><td class="num">0.60</td><td>10.00</td></tr>
<tr><td>1 September</td><td class="num">0.20</td><td class="num">1.20</td><td>10.00</td></tr>
<tr><td>1 December</td><td class="num">0.20</td><td class="num">1.80</td><td>10.00</td></tr>
<tr class="last"><td>21 December</td><td class="num">none</td><td class="num">1.80</td><td>Nothing. Its 10 euros go to the heating fund.</td></tr>
</tbody>
</table>
</div>

The numbers stay small on purpose. Nobody loses their savings to this. Holding a note all season costs about what a few hours of parking would, and it is meant to be noticed rather than to hurt.

### The shortest day

Most stamp currencies charge the stamp forever. Ours ends. On 21 December every note still in a drawer stops being money. The euros held against those notes go into a heating fund that keeps public rooms warm through January and February: the library, the school gym at weekends, the room above the market hall where people already go because it is warm.

We like this part because it makes the expiry concrete. The money doesn't vanish into a balance sheet. It turns up as radiators in rooms you can walk into.

::: pull
If you forget a note in a coat pocket, you can go and sit in what it paid for.
:::

For whoever keeps the ledger, the rule is short enough to write on a card. This is the check a shop or the town hall makes when someone hands over a note, where `ISSUE` is 1 March and `EXPIRY` is 21 December:

```ledger rule
// Is this note good today?
function accept(note, today) {
  if (today >= EXPIRY) return false;
  const due = monthsSince(ISSUE, today);  // April = 1
  return note.stamps.length >= due;
}

// Euros back, any day before expiry
const redeem = (note) => note.face * 0.95;
```

There is no app in this on purpose. A paper note with boxes on it can be checked by a shopkeeper with no phone, which matters more to us than the convenience of a QR code. A town that wants to add one later can, as long as the paper still works without it. The only state that has to be right is `note.stamps.length`, and you can count that with a finger.

## Where this has been tried

None of this is new. In 1916 the merchant and economist [Silvio Gesell](https://en.wikipedia.org/wiki/Silvio_Gesell) argued that money should wear out like everything else: food rots, rent comes due, and only money can sit still without cost. He proposed a stamp on banknotes to fix that. The idea is usually called [demurrage](https://en.wikipedia.org/wiki/Demurrage_(currency)).

::: note 3
Accounts of Wörgl vary a lot, and many of the dramatic figures that circulate online can't be traced to a source. We have only repeated what the standard histories agree on.
:::

The best-known test was in [Wörgl](https://en.wikipedia.org/wiki/W%C3%B6rgl), a small town in Tyrol, in 1932. In the middle of the Depression the mayor issued local notes that lost 1% of their value each month unless stamped. The town used them to pay for public works, and the notes changed hands much faster than the schilling. In 1933 the Austrian National Bank had the scheme stopped, on the grounds that only the national bank could issue money.[^3]

> I believe that the future will learn more from the spirit of Gesell than from that of Marx.
>
> -- John Maynard Keynes, <cite>The General Theory of Employment, Interest and Money</cite>, 1936, chapter 23

Keynes was not fully convinced by Gesell, and he said so in the same chapter. But he took the stamp seriously, which few economists of his time did. We think Wörgl keeps being retold not because it proved anything (a year is too short for that) but because it showed a town could run its own money and that people would use it.

## What we don't know

We disagree among ourselves about several things, and we would rather list them than pretend.

- Whether 2% a month is right. Wörgl used 1%. Higher makes the notes move faster, and also makes people more likely to swap them straight back.
- How visitors fit in. Someone who buys notes in August loses a little on the stamp and probably leaves with some unspent. We think that is fine, a small gift to the heating fund, but someone should ask the visitors.
- What the tax office will say. Local currencies are often legal as vouchers, under rules that differ by country. This needs a lawyer before it needs a printer.
- Whether a town of 2,000 people is too small. Below some size there aren't enough shops for the notes to go round, and they come straight back to the town hall.

There is also the question we can't answer from a desk: whether people will find the stamp annoying enough to stop using the notes. Wörgl suggests not. But a town in 2027 is not a town in 1932, and everyone now has a card that costs nothing to hold. The only way to find out is to run it for one season and count.

## Why we are not building it

We wrote this down because we think it should exist, and we know we won't be the ones to make it. It needs a council willing to try something odd for one season, a local bank willing to hold the backing, a printer who can number notes properly, and someone patient enough to keep the stamp ledger for ten months. We have none of those, and no time to find them.

What we can do is leave the idea in a state where someone else can pick it up. If you sit on a council, or know someone who does, the five steps above are most of a proposal. Change the numbers. Tell us what broke. The rest of what we have written down is in the [contents](/articles/).
