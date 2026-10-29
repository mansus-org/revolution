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

None of the parts are ours. Argo CD, ApplicationSets, Image Updater, Helm, cert-manager, Sealed Secrets and the runners are all off-the-shelf and well documented. What we built is the wiring between them: the conventions and agreements that make them behave as one platform. That wiring is what you would be copying. The real config, trimmed to the lines that matter, is in the annex at the end.

## Limits and what's next

It is small and it works. It is also fragile in ways that will matter as more apps move onto it.

**One server.** Every app, the runners and Argo CD share one machine. If it goes down, everything does. A second server also means storage both machines can see.

**Backups.** Never deleting disks is not the same as backing them up. The app data and the key that opens our secrets both need real backups, tested by restoring them.

**Old builds pile up.** Nothing cleans the registry. Every merge and every preview push leaves an image behind.

**Secrets in previews.** Previews either run without secrets or use test credentials sealed so broadly that anything on the cluster could open them. A narrower mechanism would be better.

**Nobody is told when it breaks.** A failed build, a stuck deploy or a certificate that won't renew shows up in a dashboard, but no one gets a message. Today we find out in the browser.

## Annex: the config that matters

These are real excerpts from our cluster's config repo (private) and from [hello-k3s](https://github.com/mansus-org/hello-k3s), trimmed to the lines that carry the ideas above. `# …` marks where we cut something out. Nothing else is changed.

### The org-scanning factory

This is the centrepiece: the ApplicationSet that turns every repo with a `.k3s/values.yaml` into an Application. Look at three things. The `scmProvider` generator lists the organisation every three minutes and keeps only repos that have the file: the file is the switch. The template's label and annotations are what Image Updater reads, so the factory and the watcher meet on the same Application. And `ignoreApplicationDifferences` is the ownership agreement from "Why it's built this way": the factory leaves the Helm parameters alone, because the watcher writes the version there.

```apps/mansus-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: mansus-apps
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - scmProvider:
        # Rescan the org every 3 minutes (default is 30).
        requeueAfterSeconds: 180
        cloneProtocol: https
        github:
          organization: mansus-org
          tokenRef:
            secretName: mansus-github-scm
            key: token
        filters:
          - pathsExist: [.k3s/values.yaml]
  # Image Updater writes the new image tag into spec.sources[0].helm.parameters.
  # Without this, the ApplicationSet controller would put the template back
  # (no parameters) on its next pass and roll the app back to image.tag "latest".
  ignoreApplicationDifferences:
    - jsonPointers:
        - /spec/sources/0/helm/parameters
  template:
    metadata:
      name: '{{ .repository | lower }}'
      namespace: argocd
      labels:
        mansus.org/app-platform: "true"
      annotations:
        argocd-image-updater.argoproj.io/image-list: 'app=ghcr.io/mansus-org/{{ .repository | lower }}'
        argocd-image-updater.argoproj.io/app.update-strategy: newest-build
        argocd-image-updater.argoproj.io/app.allow-tags: 'regexp:^sha-[0-9a-f]{7,40}$'
        argocd-image-updater.argoproj.io/app.helm.image-name: image.repository
        argocd-image-updater.argoproj.io/app.helm.image-tag: image.tag
        argocd-image-updater.argoproj.io/write-back-method: argocd
      finalizers:
        - resources-finalizer.argocd.argoproj.io
    spec:
      project: default
      sources:
        # 0: the shared chart from this repo. Must stay first (see above).
        # Ours points at our private config repo; use your own.
        - repoURL: https://github.com/<you>/<your-gitops-repo>.git
          targetRevision: HEAD
          path: charts/app
          helm:
            releaseName: '{{ .repository | lower }}'
            valueFiles:
              - $values/.k3s/values.yaml
        # 1: the app repo, only used for its .k3s/values.yaml.
        - repoURL: '{{ .url }}'
          targetRevision: '{{ .branch }}'
          ref: values
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{ .repository | lower }}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
        # …
```

The two `sources` are the "one template, ten-line file" idea: source 0 is the shared chart, and source 1 only exists so the chart can read `$values/.k3s/values.yaml` from the app's own repo. `allow-tags` is "tags are identity": production only ever accepts `sha-…`.

### How Image Updater finds the apps

Image Updater checks the registry every two minutes, and a single `ImageUpdater` resource tells it which Applications to look after: every one with the `mansus.org/app-platform` label. `useAnnotations: true` makes it take each app's image, tag filter and write-back method from the annotations the factory stamped on above, so there is no per-app configuration here at all.

```apps/argocd-image-updater.yaml (Helm values)
config:
  # Check GHCR every 2 minutes.
  interval: 2m
  registries:
    - name: GitHub Container Registry
      api_url: https://ghcr.io
      prefix: ghcr.io
      ping: no
      # Classic PAT with read:packages, sealed in deploy/app-platform/.
      credentials: pullsecret:argocd/ghcr-pull
# …
extraObjects:
  - apiVersion: argocd-image-updater.argoproj.io/v1alpha1
    kind: ImageUpdater
    metadata:
      name: mansus-apps
      namespace: argocd
    # …
    spec:
      applicationRefs:
        - namePattern: "*"
          labelSelectors:
            matchLabels:
              mansus.org/app-platform: "true"
          useAnnotations: true
```

### Previews

The preview factory is a `matrix`: the same org scan (minus repos that opt out with a `.k3s/no-preview` file) crossed with the open pull requests of each repo. Its template uses the same chart, and overrides four values: preview mode on, the `pr-<n>-<sha7>` tag, and the preview's own address. Previews get a different label, so Image Updater never touches them.

```apps/mansus-previews.yaml
spec:
  generators:
    - matrix:
        generators:
          - scmProvider:
              requeueAfterSeconds: 180
              # …
              filters:
                - pathsExist: [.k3s/values.yaml]
                  pathsDoNotExist: [.k3s/no-preview]
          - pullRequest:
              requeueAfterSeconds: 120
              github:
                owner: mansus-org
                repo: '{{ .repository }}'
                # …
  template:
    metadata:
      name: '{{ .repository | lower }}-pr-{{ .number }}'
      # Not mansus.org/app-platform: Image Updater must not touch previews.
      labels:
        mansus.org/app-platform-preview: "true"
      # …
    spec:
      sources:
        - # … the same shared chart as above
          helm:
            # …
            # These win over .k3s/values.yaml.
            parameters:
              - name: preview.enabled
                value: "true"
              - name: image.repository
                value: 'ghcr.io/mansus-org/{{ .repository | lower }}'
              - name: image.tag
                value: 'pr-{{ .number }}-{{ substr 0 7 .head_sha }}'
              - name: ingress.host
                value: '{{ .repository | lower }}-pr-{{ .number }}.mansus.org'
        # .k3s/values.yaml as it is in the PR's latest commit.
        - repoURL: '{{ .url }}'
          targetRevision: '{{ .head_sha }}'
          ref: values
```

### The app side: hello-k3s

This is everything a repo needs. First the switch, the whole file:

```hello-k3s/.k3s/values.yaml
# Deploy settings for this repo on the mansus.org cluster.
ingress:
  host: hello.mansus.org

port: 8080

healthCheck:
  path: /
```

Then the workflow, cut down to the parts that matter: it runs on the in-cluster runners, tags production builds `sha-<7 chars>` (plus `latest`, which a brand-new app runs before the watcher has seen its first build), and tags preview builds `pr-<n>-<sha7>`, a shape production will never accept.

```hello-k3s/.github/workflows/deploy.yml
jobs:
  build-and-push:
    if: github.event_name != 'pull_request'
    # Self-hosted ARC runners on the cluster.
    runs-on: arc-runner
    steps:
      # …
      # Tags: sha-<7 char commit> (what the cluster deploys) and latest.
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.image.outputs.name }}
          tags: |
            type=sha,prefix=sha-,format=short
            type=raw,value=latest
      # … build and push with docker/build-push-action

  preview:
    # Branches of this repo only. A fork's code never gets built here.
    if: >-
      github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: arc-runner
    steps:
      # …
      # Tag pr-<number>-<7 char head sha>. It must never look like sha-*, or
      # Image Updater would deploy it to production.
      - id: image
        shell: bash
        env:
          PR: ${{ github.event.pull_request.number }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          repo="${GITHUB_REPOSITORY#*/}"
          {
            echo "name=ghcr.io/${GITHUB_REPOSITORY,,}"
            echo "tag=pr-${PR}-${HEAD_SHA::7}"
            echo "url=https://${repo,,}-pr-${PR}.mansus.org"
          } >> "$GITHUB_OUTPUT"
      # … build and push, then comment the preview URL on the PR
```

And the app itself, a static page served by busybox as an unprivileged user:

```hello-k3s/Dockerfile
FROM busybox:stable
RUN adduser -D -u 10001 app
COPY index.html /www/index.html
USER 10001
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
```

### HTTPS: the front door and the certificate clerk

In the shared chart, three lines of the Ingress template are the whole HTTPS story: an annotation asks cert-manager for a certificate, Traefik serves it on its HTTPS entrypoint, and the certificate lands in a secret named after the app.

```charts/app/templates/ingress.yaml
metadata:
  name: {{ $name }}
  annotations:
    cert-manager.io/cluster-issuer: {{ .Values.ingress.clusterIssuer }}
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    # …
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        {{- range $hosts }}
        - {{ . }}
        {{- end }}
      secretName: {{ $name }}-tls
  # …
```

The issuer it names proves control of the address over plain HTTP, through Traefik:

```deploy/cert-manager/clusterissuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: <you@example.com>
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: traefik
```

### Runners inside the cluster

The runner scale set registers with the whole organisation, scales to zero when idle, and runs Docker-in-Docker so workflows can build images. `arc-runner`, the name of this release, is what `runs-on` asks for.

```apps/arc-runner.yaml (Helm values)
githubConfigUrl: https://github.com/mansus-org
githubConfigSecret: arc-github-secret
maxRunners: 3
minRunners: 0
# …
containerMode:
  type: dind
```

## Annex: further reading

The upstream docs for each piece, and our two public examples.

- [ApplicationSet SCM Provider generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-SCM-Provider/): scanning a GitHub org, filters such as `pathsExist`, and the template fields it provides.
- [Pull Request generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Pull-Request/): one Application per open PR, and the `number` and `head_sha` fields.
- [Matrix generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Matrix/): combining two generators, as the preview factory does.
- [Controlling resource modification](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Controlling-Resource-Modification/): `ignoreApplicationDifferences` and other ways to let something else own part of a generated Application.
- [Multiple sources for an Application](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/): a chart from one repo with a values file from another, through `ref`.
- [Argo CD Image Updater](https://argocd-image-updater.readthedocs.io/en/stable/): overview and install.
- [Image Updater update strategies](https://argocd-image-updater.readthedocs.io/en/stable/basics/update-strategies/): `newest-build`, semver and the others, and tag filters.
- [Image Updater write-back methods](https://argocd-image-updater.readthedocs.io/en/stable/basics/update-methods/): writing to the Application (`argocd`) versus committing to git.
- [Configuring applications in Image Updater](https://argocd-image-updater.readthedocs.io/en/stable/configuration/applications/): the `ImageUpdater` resource, label selectors and `useAnnotations`.
- [Image Updater registry configuration](https://argocd-image-updater.readthedocs.io/en/stable/configuration/registries/): registries, credentials and pull secrets.
- [Actions Runner Controller](https://docs.github.com/en/actions/concepts/runners/actions-runner-controller): GitHub's docs for running Actions runners on Kubernetes.
- [cert-manager ACME](https://cert-manager.io/docs/configuration/acme/): Let's Encrypt issuers in cert-manager.
- [cert-manager HTTP-01 challenge](https://cert-manager.io/docs/configuration/acme/http01/): proving control of an address through the ingress.
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets): encrypted secrets you can commit, and how scopes bind them to a namespace.
- [k3s documentation](https://docs.k3s.io/): installing and running the lightweight Kubernetes we use.
- [k3s networking services](https://docs.k3s.io/networking/networking-services): the Traefik ingress controller that ships with k3s.
- [OpenGitOps](https://opengitops.dev/): the GitOps principles, stated by the CNCF working group.
- [mansus-org/hello-k3s](https://github.com/mansus-org/hello-k3s): the smallest app on the platform, with the full workflow.
- This site's own [.k3s/values.yaml](https://github.com/mansus-org/revolution/blob/main/.k3s/values.yaml) and [deploy workflow](https://github.com/mansus-org/revolution/blob/main/.github/workflows/deploy.yml): a second real example.
