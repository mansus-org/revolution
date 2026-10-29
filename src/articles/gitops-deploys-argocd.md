---
title: "Hyperautomation: GitOps deploys for every repo in your org with Argo CD"
title_es: "Hiperautomatización: despliegues GitOps para cada repositorio de tu organización con Argo CD"
dek: We built a small platform where any repo in our GitHub org deploys itself. Add one short file, merge, and the app is live at its own HTTPS address. This is how it works, and why it is built the way it is.
dek_es: Montamos una pequeña plataforma en la que cualquier repositorio de nuestra organización de GitHub se despliega solo. Añades un fichero corto, haces merge y la app está publicada en su propia dirección HTTPS. Así funciona, y por qué está construida así.
summary: "One small server, one GitHub org, and no deploy scripts: the cluster watches git and the registry and keeps itself up to date, with a preview for every pull request."
summary_es: "Un servidor pequeño, una organización de GitHub y ningún script de despliegue: el clúster vigila git y el registro y se mantiene al día solo, con una vista previa para cada pull request."
category: architecture
number: 6
date: 2026-10-29
needs_summary: a second server, real backups, and people who try the idea on their own org
needs_summary_es: un segundo servidor, copias de seguridad de verdad y gente que pruebe la idea en su propia organización
needs_label: help out
needs_label_es: ayúdanos
handover: The platform works and deploys this site, but it lives on one machine and nobody is told when it breaks. If you build something like it, or want to help close these gaps, tell us what you find.
handover_es: La plataforma funciona y despliega este sitio, pero vive en una sola máquina y nadie se entera cuando algo falla. Si montas algo parecido, o quieres ayudar a cerrar estos huecos, cuéntanos qué descubres.
needs:
  - A second server, so one machine going down does not take every app with it
  - Backups of app data and of the key that unlocks our secrets, tested by actually restoring them
  - Automatic cleanup of old builds in the registry, starting with those of closed pull requests
  - A safer way to give previews their own test secrets
  - Alerts when a build, a deploy or a certificate fails, instead of finding out in the browser
  - Stories from people who wired the same pieces together on their own org, and what surprised them
needs_es:
  - Un segundo servidor, para que una máquina caída no se lleve todas las apps
  - Copias de seguridad de los datos de las apps y de la clave que abre nuestros secretos, probadas restaurándolas
  - Limpieza automática de compilaciones viejas en el registro, empezando por las de pull requests cerradas
  - Una forma más segura de dar a las vistas previas sus propios secretos de prueba
  - Alertas cuando falla una compilación, un despliegue o un certificado, en vez de enterarse en el navegador
  - Experiencias de gente que haya conectado las mismas piezas en su propia organización, y qué les sorprendió
---

## What we built

Sit in a developer's seat for a moment. You have a repo in our GitHub organisation with a small web app in it. You add one short file that describes the app: its web address, the port it listens on, whether it needs a disk. You merge. A few minutes later the app is live at its own HTTPS address, with a valid certificate. You did not open a terminal on any server. You did not ask anyone for a deploy.

From then on, every merge to the main branch ships. Every pull request gets its own throwaway copy of the app at its own address, and a comment on the PR links to it. Close the PR and the copy disappears.

::: pull
Add one small file, merge, and a few minutes later the app is live. Nobody touches a server.
:::

All of this runs on one small rented server. The smallest example is [hello-k3s](https://github.com/mansus-org/hello-k3s), a page that says hello, live at <https://hello.mansus.org>. The site you are reading is deployed the same way: this article went out through a preview of its own before it was merged.

::: figure Fig. 1
![Map of the platform in three bands. Build: the hello-k3s repo runs a workflow on a runner inside the cluster, which pushes a tagged image to the registry. Deploy: an org scan feeds the ApplicationSet, which creates an Application; Image Updater sees the new tag and tells the Application; Argo CD renders the shared chart. Serve: Argo CD runs the hello-k3s app, Traefik routes traffic to it, and cert-manager gives Traefik the HTTPS certificate.](/articles/images/k3s-platform-map.png){colour wide}
The whole platform, drawn for hello-k3s. Builds happen on runners inside the cluster, Argo CD and its helpers deploy, and Traefik and cert-manager serve. The diagrams were made with [Archify](https://github.com/tt-a1i/archify); click or tap one to open it full size.
:::

## The core idea: the cluster pulls, nobody pushes

The usual way to deploy is a script. Something outside the server holds the keys, logs in, and tells the server what to do. It works until it doesn't: a script half-runs, someone fixes a thing by hand, and now nobody is sure what is actually running.

We turned that around. Git, together with the container registry, is the *description* of what should exist: which apps, configured how, running which build. Inside the server sits a controller, Argo CD, whose only job is to compare that description with reality and close the gap. It does this all the time, not only when someone presses a button. This is GitOps.[^1]

::: note 1
GitOps: running infrastructure so that a git repository holds the desired state and software inside the system keeps applying it. Changes happen by changing git, not by logging in.
:::

Three things follow from this, and they are why it feels calm. Nothing outside the cluster needs keys to it; the build system only produces images, and the cluster decides to run them. A manual change that drifts from the description gets put back. And if the server burns down, a new one pointed at the same git repository rebuilds the same platform, because the description never lived on the server.

## How it works

Follow one merge from start to finish. Each beat is one component doing one thing.

**The file is the switch.** A repo joins the platform by containing the small app description on its main branch. There is no list of apps anywhere to edit. Remove the file and the app goes away.

**A factory watches the whole org.** Argo CD has a feature called an ApplicationSet: a factory that stamps out one deployment record from a template for every item in a list. Ours lists the repositories in the organisation every few minutes. Every repo that has the file gets an app, named after the repo, in a space of its own on the cluster.

**The build runs inside the cluster.** When code lands on main, the repo's GitHub Actions workflow runs. The runners that execute it live on the same server, as one more thing the cluster runs. The workflow builds a container image and pushes it to GitHub's container registry, tagged with the commit it came from. Every build has a unique name.

**A watcher notices the new build.** Argo CD Image Updater checks the registry every couple of minutes. When a newer production build appears, it tells Argo CD to run that one. That is the whole release step.

**One template makes the app real.** Every app is drawn from the same Helm chart, a parameterised template for everything an app needs on the cluster: the running program, the internal address that reaches it, the route from the outside world, a disk if it asked for one, and the secrets it needs. The repo's ten-line file fills in the blanks. Argo CD renders the template and makes the cluster match it.

**The front door and the certificate clerk.** Traefik, the web server in front of the cluster, routes each address to the right app. cert-manager sees a new address, asks Let's Encrypt for a free certificate, proves to it that we control the address, and keeps the certificate renewed.

::: figure Fig. 2
![Sequence from merge to live. Build: GitHub runs the workflow on a runner in the cluster, which pushes a commit-tagged image to the registry. Discover, first deploy only: the ApplicationSet lists repos, finds that hello-k3s has the app file and creates its Application. Roll out: Image Updater checks the registry, finds the newest production build and tells Argo CD, which applies the rendered chart. HTTPS, first deploy only: cert-manager orders a certificate for hello.mansus.org, Let's Encrypt checks it through Traefik, and the certificate is stored.](/articles/images/k3s-merge-to-live.png){colour wide}
A merge in hello-k3s becoming the live site. Finding the repo and getting the certificate only happen the first time; after that, a release is a build and a short wait.
:::

The total from merge to live is the build time plus a couple of minutes. Most of the waiting is the watcher's next look at the registry.

::: figure Fig. 3
![Tree of what one app becomes. The Application hello-k3s owns a space of the same name, which holds the running app, its internal address, its public route at hello.mansus.org with the certificate, and the encrypted credential it uses to pull its image.](/articles/images/k3s-hello-resources.png){colour wide}
What the ten-line file turns into for hello-k3s. Everything is named after the repo, so there is only one name to remember.
:::

## Previews for every pull request

Previews reuse the same factory with a different list. Instead of "repos that have the file", it walks "open pull requests in those repos". Each one gets its own app, in its own space on the cluster, at its own address made from the repo name and the PR number.

The build is the same workflow with a different tag. Preview builds are tagged with the PR number, and production only accepts tags in the commit shape. The two families can't be mistaken for each other, so a pull request can never reach production by accident, however its build is named.

Closing or merging the PR removes it from the list, and the factory removes everything it made: the app, its address, its certificate, its disk and its space. Nothing is left to clean up by hand.

One rule protects the server. Pull requests from forks, which means code from strangers, are never built. The runners live inside the cluster, and we don't run code we haven't agreed to run.

::: figure Fig. 4
![Sequence for a preview. A push to a PR branch runs the preview build on a runner in the cluster, which pushes an image tagged with the PR number and posts a comment with the preview address. The preview ApplicationSet lists open PRs, finds the new commit and creates the preview Application; Argo CD applies the chart in preview mode. When the PR is closed or merged, the ApplicationSet deletes the preview.](/articles/images/k3s-pr-preview.png){colour wide}
The life of a preview. It appears with the first push, follows every later push, and goes away with the PR.
:::

Previews are deliberately modest. They run one copy, reserve almost nothing, and start with an empty disk; they never see production data.

## Why it's built this way

Every piece above is standard. The choices between them are where the design lives.

**One template for every app.** Convention over configuration. Every app gets the same shape, so the per-app file only says what is different: an address, a port, maybe a disk. Fixing something in the template fixes it for every app at once. The cost is that an unusual app has to fit the mould, or the mould has to grow.

**Opt in with a file, not a list.** The decision to deploy lives in the repo it is about. Nobody edits a central registry of apps, so adding an app never needs a change to the platform, and the platform never drifts from what the repos say.

**Tags are identity.** A production build is named after its commit. A preview build is named after its pull request. Each side only accepts its own shape, so there is no setting anyone can get wrong that would ship a preview to production.

**The cluster owns "which version is running".** The image watcher could commit every new build number to git. We let it record the choice on the cluster instead. Git stays free of thousands of "bump version" commits, and no bot needs write access to any repo. The trade-off is real: git no longer tells you exactly which build is live; the cluster does. If that record is lost, the app falls back to the latest build, which is the same one, and the watcher writes the exact version back within minutes. Rolling back means re-running an older build so it becomes the newest, not clicking an old version in a dashboard.

**Two automations, one object, clear ownership.** The factory keeps every app's record identical to its template. The image watcher writes the chosen version onto that same record. Left alone, they would undo each other forever and the app would flicker between versions. So the factory is told to leave one field alone, and that field belongs to the watcher. Wherever two automations touch the same thing, they need to agree on who owns which part.

**Data is sacred.** Disks are never deleted automatically. Removing an app, renaming it or turning its disk off leaves the data in place. Deleting it is a deliberate act by a person. Previews are the exception, because their disks never held anything that mattered.

**Runners inside the cluster.** Builds run on our own server rather than on hosted machines. There is no per-minute bill, private repos build for free, and images are pushed from next to where they will run. The trade-off: a heavy build competes with the apps for the same memory. On a small server that is a real choice, and moving builds back to hosted machines would change nothing else in the chain.

**Secrets live in git, encrypted.** Sealed Secrets lets us put encrypted credentials in the repos, next to everything else. Only the cluster holds the key to open them, and each secret only opens in the space it was made for. That keeps "git describes everything" true even for passwords. It is also why previews don't get production secrets: a preview lives in a different space, so the production secret simply won't open there.

## How to replicate it

You don't need our code to build this; the idea carries. Here are the ingredients in the order we would put them together. Each step works on its own before the next one is added.

1. **A small Kubernetes cluster with a front door.** We use k3s, a lightweight Kubernetes that fits on one modest server and comes with Traefik. Point a wildcard DNS record at it, so every new address resolves without a ticket.
2. **A GitOps controller watching one repo of your own.** Install Argo CD and have it manage everything else from a single configuration repository. From here on, you change the platform by changing that repo.
3. **Secret encryption.** Install Sealed Secrets early, so the credentials of every later step can live in git.
4. **Certificates.** Add cert-manager with Let's Encrypt, and check that a test address gets a real certificate.
5. **Credentials.** Give the cluster read access to your organisation's repositories and to your container registry. Keep them narrow, and seal them.
6. **Runners.** Run GitHub Actions runners inside the cluster, or skip this step and use hosted ones.
7. **The shared template.** Write one Helm chart that turns a short app description into everything an app needs. Deploy one app with it by hand first.
8. **The org-scanning factory.** Point an ApplicationSet at your organisation, keyed on the presence of the app file. Now new apps appear on their own.
9. **The image watcher.** Add Image Updater so new builds roll out without anyone touching git. Settle who owns which part of the app record before you switch it on.
10. **Previews, last.** A second factory over open pull requests, with its own tag shape and its own addresses. It is the most delicate part, so add it once everything else is boring.

A few things to decide up front, because they are hard to change later. *Naming*: we use the repo name as the name of everything, so repo names must be valid there too. *Domain and DNS*: a wildcard record is what makes previews possible without a step per PR. *Secrets in previews*: decide whether previews run without secrets, or get separate test credentials, before someone reaches for the production ones.

The pitfalls we hit, one line each:

- Two automations writing the same field fight quietly; the symptom is an app flipping between versions.
- An encrypted secret is bound to where it was made, so a secret sealed for one space won't open in another.
- Certificates fail until DNS points at the server, and Let's Encrypt limits how many you can ask for in a week.
- A brand-new app needs something sensible to run before the watcher has seen its first build.
- Builds and apps on one machine share memory; a big build can starve a small app.

None of the parts are ours. Argo CD, ApplicationSets, Image Updater, Helm, cert-manager, Sealed Secrets and the runners are all off-the-shelf and well documented. What we built is the wiring between them: the conventions and agreements that make them behave as one platform. That wiring is what you would be copying.

## Limits and what's next

It is small and it works. It is also fragile in ways that will matter as more apps move onto it.

**One server.** Every app, the runners and Argo CD share one machine. If it goes down, everything does. A second server also means storage both machines can see.

**Backups.** Never deleting disks is not the same as backing them up. The app data and the key that opens our secrets both need real backups, tested by restoring them.

**Old builds pile up.** Nothing cleans the registry. Every merge and every preview push leaves an image behind.

**Secrets in previews.** Previews either run without secrets or use test credentials sealed so broadly that anything on the cluster could open them. A narrower mechanism would be better.

**Nobody is told when it breaks.** A failed build, a stuck deploy or a certificate that won't renew shows up in a dashboard, but no one gets a message. Today we find out in the browser.
