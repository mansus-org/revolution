---
title: "The k3s app platform: merge, and it's live"
title_es: "La plataforma de apps en k3s: haces merge y está publicado"
dek: How any repo in the mansus-org GitHub org deploys itself to our one-node k3s cluster, with its own HTTPS address and a temporary preview for every pull request. Every piece, what it does, and why it is set up the way it is.
dek_es: Cómo cualquier repositorio de la organización mansus-org en GitHub se despliega solo en nuestro clúster k3s de un nodo, con su propia dirección HTTPS y una vista previa temporal para cada pull request. Cada pieza, qué hace y por qué está montada así.
summary: Add one values file to a repo and every merge to main goes live minutes later, plus a preview per pull request. Built from Argo CD, Image Updater, in-cluster runners and one shared Helm chart.
summary_es: Añade un fichero de valores a un repositorio y cada merge a main se publica minutos después, con una vista previa por pull request. Hecho con Argo CD, Image Updater, runners en el clúster y un chart de Helm compartido.
category: architecture
number: 6
date: 2026-10-29
needs_summary: people who run Kubernetes for real and can make one node less fragile
needs_summary_es: gente que lleve Kubernetes en serio y sepa hacer menos frágil un solo nodo
needs_label: where help would land
needs_label_es: dónde ayudaría
handover: It works, and this site is deployed by it. Making it sturdy would go faster with you.
handover_es: Funciona, y esta web se despliega con ella. Hacerla robusta iría más rápido contigo.
needs:
  - A second node, so one machine going down does not take every app with it
  - Backups of app disks (PVCs) and the shared Postgres, tested by actually restoring them
  - Automatic cleanup of old images on GHCR, starting with closed pull requests' pr-* tags
  - A safer way to give previews their own secrets than sealing them cluster-wide
  - Alerts when a build, a sync or a certificate fails, instead of finding out in the browser
needs_es:
  - Un segundo nodo, para que una máquina caída no se lleve todas las apps
  - Copias de seguridad de los discos de las apps (PVC) y del Postgres compartido, probadas restaurándolas
  - Limpieza automática de imágenes viejas en GHCR, empezando por las etiquetas pr-* de pull requests cerradas
  - Una forma más segura de dar secretos propios a las vistas previas que sellarlos para todo el clúster
  - Alertas cuando falla una compilación, una sincronización o un certificado, en vez de enterarse en el navegador
---

## Merge, and it's live

Any repository in the [mansus-org](https://github.com/mansus-org) GitHub organisation can deploy itself to our server. It needs three files: a `Dockerfile`, a short `.k3s/values.yaml` that says which web address the app answers on, and a standard workflow file. After that, merging a pull request to `main` builds the image, and a few minutes later the new version is live at its own HTTPS address. Nobody edits the cluster's configuration repository, runs a command or asks anyone. Every open pull request also gets a temporary copy of the app at `https://<repo>-pr-<number>.mansus.org`, deleted when the pull request closes.

::: pull
Merge, and a few minutes later it is live. Nobody touches the cluster's repository for a release.
:::

The running example in this article is [mansus-org/hello-k3s](https://github.com/mansus-org/hello-k3s), the smallest app that works: busybox `httpd` serving one page on port 8080, live at <https://hello.mansus.org>. The second example is this site. [Revolution](https://github.com/mansus-org/revolution) has the same two files and is served at <https://revolution.mansus.org>, and the pull request that added this article had its own preview.

The article assumes you know Docker and git. It explains the Kubernetes and Argo CD parts as they come up. Everything here is taken from the cluster's configuration repository, `nemoNoboru/k3s-hetzner-gitops`, which is private, and from the two app repositories, which are public.

## The cast

::: figure Fig. 1
![Map of the platform in three bands. Build: the hello-k3s repo runs a workflow on an ARC runner, which pushes a sha tag to GHCR. Deploy: an org scan feeds the ApplicationSet, which creates an Application; Image Updater sees the new tag and sets image.tag on the Application; Argo CD renders charts/app. Serve: Argo CD syncs the hello-k3s pod, which Traefik reaches through a Service, and cert-manager gives Traefik the TLS certificate.](/articles/images/k3s-platform-map.png){colour wide}
The whole platform. Build happens in GitHub and on runners inside the cluster, deploy is Argo CD and its helpers, serving is Traefik with certificates from cert-manager. The diagrams in this article were made with [Archify](https://github.com/tt-a1i/archify); click or tap one to open it full size.
:::

Each part is a common open-source tool; what is ours is how they are wired. Here is each part, its job, and the trade-off it brings.

### k3s on one Hetzner node

::: note 1
A few Kubernetes words used below. A **Deployment** keeps a number of copies of a container running and replaces them when the image changes. A **Service** gives those copies one stable internal address. An **Ingress** says "requests for this host name go to that Service". A **namespace** is a folder for objects, so two apps can both have a Deployment called `web`.
:::

[k3s](https://k3s.io/) is a small Kubernetes distribution: one binary, little memory, made for single machines and edge boxes. Kubernetes is the program that runs containers for you. Instead of `docker run`, you hand it a description of what should exist ("one copy of this image, reachable at this name") and it keeps reality matching the description, restarting what crashes.[^1] Our cluster is one node, one virtual machine at Hetzner. k3s ships with [Traefik](https://traefik.io/traefik/), a web server and reverse proxy, as its ingress controller: the one program that listens on ports 80 and 443 for the whole node and forwards each request to the right app by host name.

One node is cheap and simple. It also means no redundancy, which comes back at the end.

### Argo CD and the root app

[Argo CD](https://argo-cd.readthedocs.io/) runs inside the cluster and makes the cluster match what is in git. That approach is called GitOps: the repository is the source of truth, and a controller applies it. Its unit is the **Application**, a small object that says "render these manifests from this repository and apply them in this namespace". With `automated`, `prune` and `selfHeal` turned on, Argo CD applies changes on its own, deletes what was removed from git, and undoes changes made by hand.

The cluster is bootstrapped from one Application, `root-app`, which points at the `apps/` folder of the configuration repository. Every file in that folder is itself an Application: cert-manager, Sealed Secrets, the runners, Image Updater, the two ApplicationSets below, and every other service on the server. This is the "app of apps" pattern. Add a file to `apps/`, and Argo CD installs it.

Argo CD was already how this cluster ran everything. The platform is built from Argo CD's own extensions (ApplicationSets and Image Updater) rather than a second deployment tool next to it. [Flux](https://fluxcd.io/) has equivalents for each part; using it would have meant two systems doing the same job on one server. The platform needs Argo CD 2.10 or newer.

### The ApplicationSet that scans the org

An **ApplicationSet** is a factory for Applications. It takes a list from a *generator* and stamps out one Application per item from a template. Ours, `mansus-apps`, uses the `scmProvider` generator: it asks GitHub for every repository in `mansus-org`, keeps those whose default branch has a `.k3s/values.yaml`, and makes one Application per repository, named after it in lower case. It rescans every 3 minutes (the default is 30). Delete the file from a repository, and on the next scan its Application goes away.

That filter is the whole on switch. The configuration repository never lists the apps. It describes how to deploy *an* app, once, and the org decides which apps exist.

### One shared Helm chart

[Helm](https://helm.sh/) is a template language for Kubernetes files. A *chart* is a folder of templates plus a `values.yaml` of defaults; you override some values and Helm renders the final YAML. The platform has one chart, `charts/app`, used by every app. It turns a values file of about ten lines into a Deployment, a Service, an Ingress with a certificate, an image pull secret and, if asked, a disk.

One chart means every app is deployed the same way, and a fix to the chart reaches every app on the next sync. The price is that apps can only do what the chart offers: one container, one port, web traffic. The chart also has a strict schema. A typo such as `ingres:` makes the deploy fail with an error that names the key, instead of being silently ignored.

### GitHub Actions on ARC runners, inside the cluster

::: note 2
Docker-in-Docker: the runner pod gets a second container running its own Docker daemon, so `docker build` works inside a pod without access to the node's own container runtime.
:::

Images are built by GitHub Actions, but not on GitHub's machines. [Actions Runner Controller](https://github.com/actions/actions-runner-controller) (ARC) runs the jobs as pods in our cluster. A small *listener* pod keeps a connection to GitHub; when a job with `runs-on: arc-runner` is queued anywhere in the org, ARC starts a runner pod for it and deletes it afterwards. It runs at most 3 at once and none when idle. Each runner uses Docker-in-Docker,[^2] reserves a quarter of a CPU and 256 MiB of memory, and may use up to one CPU and 1 GiB.

The trade-off against GitHub-hosted runners: builds use our node's CPU and memory, so a busy build competes with the apps, and a runner that does not fit waits as `Pending`. In return the org's runners are one shared pool that the cluster itself manages, defined in the same repository as everything else. There is one catch for public repositories, covered with the other design decisions further down.

### GHCR

The GitHub Container Registry, `ghcr.io`, stores the images, at `ghcr.io/mansus-org/<repo>`. The workflow logs in with the `GITHUB_TOKEN` GitHub gives every job, with `packages: write` permission, so an app repository holds no secrets of its own. Images built from private repositories are private.

### Argo CD Image Updater

[Argo CD Image Updater](https://argocd-image-updater.readthedocs.io/) (version 1.3.2 here) closes the gap between "a new image exists" and "the Application uses it". Every 2 minutes it lists the tags of each app's image on GHCR, keeps only tags shaped like `sha-` followed by 7 to 40 hex characters, picks the one built most recently, and, if it differs from what is running, sets it as the `image.tag` Helm parameter on the Application. Argo CD notices the change and rolls the pod.

The common alternative is a pipeline that commits the new tag into a git repository, so git records exactly what runs. Image Updater can do that too. We use its `argocd` write-back method instead: it edits the Application object in the cluster and makes no commits. No bot needs write access to any repository and the history has no "bump tag" commits. The cost is that git no longer says which build is running; more on that further down.

### cert-manager and Let's Encrypt

[cert-manager](https://cert-manager.io/) gets a free certificate from [Let's Encrypt](https://letsencrypt.org/) for every host an Ingress names, and renews it. The cluster has a `letsencrypt-prod` issuer that proves ownership with the **HTTP-01** challenge: Let's Encrypt asks for a token at `http://<host>/.well-known/acme-challenge/…`, and Traefik serves it.

HTTP-01 needs nothing but a working DNS record. The other common method, DNS-01, proves ownership by writing a DNS record, which means giving the cluster credentials for the DNS provider; it is also the only way to get a wildcard certificate. With HTTP-01 each host gets its own certificate, the host must already point at the server before the first one can be issued, and every certificate counts against Let's Encrypt's weekly limit. All three matter for previews.

### Sealed Secrets

Kubernetes secrets cannot go into git as they are, and with GitOps everything goes into git. [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) solves this. A controller in the cluster holds a private key. Anyone with cluster access can encrypt ("seal") a secret with its public key using the `kubeseal` command; only the controller can decrypt it. A `SealedSecret` is safe to commit, and the controller turns it into an ordinary Secret inside the cluster.

A sealed value is bound to where it may be decrypted. The default *strict* scope ties it to one name in one namespace; *namespace-wide* to any name in one namespace; *cluster-wide* to anywhere. That binding is why previews and secrets do not mix easily.

## One merge, step by step

::: figure Fig. 2
![Sequence from merge to live. Build: GitHub runs deploy.yml on an ARC runner, which pushes sha-afb4504 and latest to GHCR. Discover, first deploy only: the ApplicationSet lists repos, finds hello-k3s has .k3s/values.yaml and creates Application hello-k3s. Roll out: Image Updater lists tags every 2 minutes, gets the newest sha tag and sets the image.tag parameter; Argo CD applies the rendered chart to the k3s node. TLS, first deploy only: the Ingress carries the cluster-issuer annotation, cert-manager orders a certificate for hello.mansus.org, Let's Encrypt checks HTTP-01 through Traefik and the certificate lands in Secret hello-k3s-tls.](/articles/images/k3s-merge-to-live.png){colour wide}
A merge in hello-k3s becoming https://hello.mansus.org. The discovery and certificate phases only happen the first time.
:::

This is everything hello-k3s holds besides its page:

```hello-k3s/.k3s/values.yaml, the whole file
# Deploy settings for this repo on the mansus.org cluster.
ingress:
  host: hello.mansus.org

port: 8080

healthCheck:
  path: /
```

```hello-k3s/Dockerfile
FROM busybox:stable
RUN adduser -D -u 10001 app
COPY index.html /www/index.html
USER 10001
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
```

The workflow, `.github/workflows/deploy.yml`, is copied unchanged from a template in the configuration repository. Revolution's copy is identical. The production half:

```deploy.yml, the build-and-push job (abridged)
on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  packages: write

# main: one build at a time; a newer push waits instead of racing an older one.
# PRs: a new push cancels the PR's running build.
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  build-and-push:
    if: github.event_name != 'pull_request'
    runs-on: arc-runner
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3     # ghcr.io with GITHUB_TOKEN
      - id: meta
        uses: docker/metadata-action@v5
        with:
          tags: |
            type=sha,prefix=sha-,format=short
            type=raw,value=latest
      - uses: docker/build-push-action@v6
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=<image>:buildcache
          cache-to: type=registry,ref=<image>:buildcache,mode=max
```

Now follow one merge, commit `afb4504`.

1. **The build.** GitHub queues the `deploy` workflow. ARC's listener sees a job for `arc-runner` and starts a runner pod in the cluster. The job builds the `Dockerfile` and pushes two tags: `sha-afb4504`, the first seven characters of the commit, and `latest`. Layers are cached in a `buildcache` tag on the registry, so a small change rebuilds quickly. If a second merge lands during the build, its run waits rather than racing the first.
2. **Discovery, the first time only.** Within 3 minutes the `mansus-apps` scan finds that `hello-k3s` has `.k3s/values.yaml` and creates the Application `hello-k3s`, deploying into a namespace also called `hello-k3s`. After the first time the Application already exists, and this step does nothing.
3. **The tag.** Within 2 minutes of the push, Image Updater lists the image's tags, keeps the `sha-*` ones, sees `sha-afb4504` is the newest build and writes it on the Application as the `image.tag` parameter.
4. **The rollout.** Argo CD renders `charts/app` with the app's values and the new tag and applies the result. The Deployment's image changes to `ghcr.io/mansus-org/hello-k3s:sha-afb4504`, so Kubernetes starts a new pod, waits until `/` answers 200 on port 8080, then stops the old one. No downtime for an app without a disk.
5. **The certificate, the first time only.** The Ingress for `hello.mansus.org` carries the annotation `cert-manager.io/cluster-issuer: letsencrypt-prod`. cert-manager orders a certificate, Let's Encrypt fetches its challenge through Traefik, and the certificate is stored in the Secret `hello-k3s-tls`. Traefik serves `https://hello.mansus.org` with it.

::: note 3
An Application can take its manifests from several repositories at once. A source marked with `ref:` exposes its files to the others under a name, here `$values`.
:::

How do the chart, which lives in the configuration repository, and the values file, which lives in the app repository, meet? The generated Application has two *sources*.[^3] Source 0 is `charts/app` from the configuration repository. Source 1 is the app's own repository at its default branch, used only as a reference named `values`. Source 0 then loads `$values/.k3s/values.yaml` as its values file. A change to the values file on `main`, say a new environment variable, deploys on the next sync without any image being built.

Timing: a normal release takes the build time plus up to 2 minutes for Image Updater plus a few seconds for the rollout. The very first deploy adds up to 3 minutes for the org scan and about a minute for the certificate. If the Application appears before the image is pushed, the pod waits in `ImagePullBackOff` and starts by itself once the image exists.

## What one values file turns into

::: figure Fig. 3
![Tree of objects. Application hello-k3s owns namespace hello-k3s, which holds Deployment hello-k3s, Service hello-k3s on port 8080, Ingress hello.mansus.org with its Secret hello-k3s-tls, and SealedSecret ghcr-pull with the Secret ghcr-pull it unseals into.](/articles/images/k3s-hello-resources.png){colour wide}
Everything Argo CD keeps in sync for hello-k3s. The two Secrets at the bottom are made by cert-manager and the Sealed Secrets controller, not rendered by the chart.
:::

Every name comes from the Helm release name, which the ApplicationSet sets to the repository name in lower case. For hello-k3s the chart renders:

- **Deployment `hello-k3s`.** One replica by default. The image is `ghcr.io/mansus-org/<repo>:<tag>`, with the repository filled in by default, so an app never has to name its own image. Readiness and liveness checks call `healthCheck.path` on the app's port; an empty path means "just check the port is open". Default resources are a reservation of 50m CPU and 64 MiB and a limit of half a CPU and 256 MiB. The pull policy is `Always` for the tag `latest`, because the same name can point at a new build, and `IfNotPresent` for a `sha-*` tag, which never changes.
- **Service `hello-k3s`.** An internal address on the same port as the container.
- **Ingress `hello-k3s`.** Traefik, the `websecure` entrypoint (HTTPS), the host from `ingress.host` plus any `ingress.extraHosts` on the same certificate, and the cert-manager annotation. cert-manager writes the certificate to `hello-k3s-tls`.
- **SealedSecret `ghcr-pull`.** Private images need credentials to pull. The chart's defaults contain one sealed copy of a read-only GHCR token, sealed *cluster-wide*, so the same encrypted value decrypts in every app's namespace. The chart adds it to the pod's pull secrets. A new private app pulls its image with no setup at all.
- **The app's own SealedSecrets**, if `sealedSecrets` lists any, and their keys as environment variables through `envFromSecrets`.
- **PersistentVolumeClaim `<repo>-data`**, only with `persistence.enabled`. A PVC is a request for a disk that outlives pods; on this cluster the default is a folder on the node's local disk. With a disk the Deployment switches from rolling updates to *Recreate*, because a single-node disk can only be mounted by one pod at a time: the old pod stops before the new one starts, so there is a short gap.

The namespace itself comes from Argo CD's `CreateNamespace=true` option, not from the chart. That detail matters for previews.

Revolution shows the next step up from hello-k3s. It is the same server, busybox `httpd`, with its reservation turned down to almost nothing:

```revolution/.k3s/values.yaml
ingress:
  host: revolution.mansus.org

port: 8080

healthCheck:
  path: /

# busybox httpd needs a few MB.
resources:
  requests: { cpu: 5m, memory: 8Mi }
  limits: { memory: 32Mi }
```

Its `Dockerfile` builds the site with Bun and Eleventy, then copies the result into a busybox image. The GitHub Pages workflow still runs next to it.

## A preview for every pull request

::: figure Fig. 4
![Sequence for a preview. A push to a PR branch runs the preview job on an ARC runner, which pushes pr-12-abc1234 to GHCR and posts a sticky comment with the preview URL. The mansus-previews ApplicationSet lists open PRs every 2 minutes, gets PR 12 with head abc1234 and creates Application hello-k3s-pr-12; Argo CD applies the chart with preview.enabled. When the PR is closed or merged, mansus-previews deletes the Application.](/articles/images/k3s-pr-preview.png){colour wide}
Pull request 12 in hello-k3s becoming https://hello-k3s-pr-12.mansus.org, and going away when the PR closes.
:::

Every open pull request in an onboarded repository gets its own copy of the app, at `https://<repo>-pr-<number>.mansus.org`. Pull request 12 in hello-k3s is at `https://hello-k3s-pr-12.mansus.org`. Two pieces make it happen.

**The workflow's `preview` job.** On every push to a pull request, it checks out the PR's own head commit (not the merge commit GitHub uses by default, because the cluster will look for this exact commit), builds it and pushes one tag: `pr-<number>-<7 characters of the head commit>`, for example `pr-12-abc1234`. It then posts a comment on the PR with the link and edits the same comment on later pushes. Its build cache is kept separate per PR, so a PR build never overwrites the production `buildcache`. A newer push to the same PR cancels the running build.

**A second ApplicationSet, `mansus-previews`.** It uses a *matrix* generator: the same org scan as production, crossed with a `pullRequest` generator that lists each repository's open pull requests every 2 minutes. Each pair (repository, open PR) becomes an Application called `<repo>-pr-<number>`, in a namespace of the same name. Its template sets four Helm parameters, which win over the values file: `preview.enabled=true`, the image repository, `image.tag=pr-<number>-<head sha>` and `ingress.host=<repo>-pr-<number>.mansus.org`. Its values source is the app repository at the PR's head commit, so a change to `.k3s/values.yaml` inside the PR shows up in its preview.

Previews need no Image Updater. The ApplicationSet already knows each PR's head commit, so the tag comes straight from the template. They are labelled `mansus.org/app-platform-preview` rather than `mansus.org/app-platform`, so Image Updater does not look at them.

::: pull
A `pr-*` tag never matches `sha-*`, so a pull request cannot reach production by accident.
:::

That rule is the main safety property, and it is enforced twice. Production only ever takes tags matching `^sha-[0-9a-f]{7,40}$`, and preview builds only ever push `pr-*`.

### Closing the PR deletes everything

::: note 4
A finalizer is a marker that stops Kubernetes deleting an object until some controller has done its cleanup. Argo CD's `resources-finalizer` makes it delete everything an Application created before the Application itself goes.
:::

When the PR is closed or merged, it drops out of the open-PR list, and within 2 minutes the ApplicationSet deletes its Application. The Application carries Argo CD's resources finalizer,[^4] so Argo CD first deletes everything it made: pod, Service, Ingress, certificate, disk, and the namespace.

The namespace is the subtle part. Argo CD never deletes a namespace it created through `CreateNamespace=true`; that is a safety rule, so deleting an Application cannot wipe a namespace someone else uses. Production relies on it. For previews it would leave an empty namespace behind for every PR ever opened. So with `preview.enabled` the chart renders the `Namespace` object itself. It is then an ordinary resource of the Application, and the finalizer deletes it like the rest. The preview ApplicationSet does not set `CreateNamespace`.

### How a preview differs from production

The preview runs the same chart with the PR's own values file, with these changes:

| | Production | Preview |
| --- | --- | --- |
| Application and namespace | `hello-k3s` | `hello-k3s-pr-12` |
| URL | `ingress.host` and `ingress.extraHosts` | only `hello-k3s-pr-12.mansus.org` |
| Image tag | newest `sha-*`, set by Image Updater | `pr-12-<head sha>`, from the PR |
| Replicas | `replicas` | always 1 |
| Reserved CPU and memory | `resources.requests` | 10m CPU, 32 MiB (limits unchanged) |
| Disk | kept forever | new and empty, deleted with the PR |
| Secrets | `sealedSecrets` | `preview.sealedSecrets` if set, else `sealedSecrets` |

The chart drops `extraHosts` in previews on purpose: a preview must never answer for a production domain. The reservation is lowered so open PRs do not crowd out real apps, but the limits stay, so an app that needs 512 MiB is not killed for running out of memory in its preview.

### Pull requests from forks are never built

The `preview` job only runs when the PR's branch lives in the repository itself. A pull request from a fork still gets an Application, because the ApplicationSet sees every open PR, but no image is ever pushed for it, so its pod waits in `ImagePullBackOff` until the PR closes. This is deliberate. The runners are inside our cluster, and code from strangers should never run there.

### Limits

- **Data starts empty.** A preview gets a new disk and never sees production data.
- **Secrets do not decrypt by default.** Production secrets are sealed for the namespace `<repo>`. A preview runs in `<repo>-pr-<number>`, where they cannot be decrypted, and the pod fails with `CreateContainerConfigError`. The way out is to seal separate *test* credentials cluster-wide and list them under `preview.sealedSecrets`. A cluster-wide sealed secret can be decrypted by anyone who can create resources on the cluster. On a cluster with one owner that is acceptable for test credentials, never for production ones.
- **Certificates.** Each preview gets its own certificate, and Let's Encrypt allows 50 new certificates per week for all of `mansus.org`, production included. A normal rate of pull requests is far below that.
- **Timing.** The build and the ApplicationSet's 2-minute poll run side by side. If the cluster sees the new commit before the image exists, the new pod retries for a while (Kubernetes backs off up to 5 minutes between pulls) while the previous version of the preview keeps serving. So: build time plus up to 2 minutes, sometimes up to 5 more.
- **Resources.** Every preview is one more pod on the single node. Ten open PRs of a 256 MiB app can use up to 2.5 GiB.
- **The first PR.** The pull request that adds `.k3s/values.yaml` gets no preview, because the repository only counts once the file is on the default branch.
- **Opting out** is per repository: an empty `.k3s/no-preview` file on the default branch. The repository can't use a GitHub topic for this, because the generator's topic filter can only include repositories, not exclude them.

## The decisions that look like mistakes

Several settings look wrong at first sight and are load-bearing. Here is each one and what it protects.

### Two controllers, one Application

The ApplicationSet controller owns the Applications it generates. By default it rewrites them to match its template on every pass. Image Updater writes the tag onto the same object. Left alone, the two would fight: Image Updater sets `sha-afb4504`, the ApplicationSet puts the template back without parameters, the app rolls back to `latest`, and two minutes later it all happens again.

`mansus-apps` therefore sets `ignoreApplicationDifferences` on the JSON path `/spec/sources/0/helm/parameters`. It is the documented way to tell an ApplicationSet "another controller owns this field". Two rules follow from it:

- **The chart must stay the first source and keep its `helm:` block.** The ignored path says `sources/0`, and Image Updater writes to the first source that has a `helm:` block. Swap the two sources and both point at the wrong place.
- **Editing the `sources` list in the template resets the tag once.** The controller patches a list as a whole. After such a change every app falls back to `latest` for up to 2 minutes, then Image Updater restores its `sha-*` tag. Since `latest` and the newest `sha-*` tag are the same build, nothing visible changes.

### The deployed tag lives only in the cluster

With write-back method `argocd`, the running tag is a field on an object in the cluster, not a line in git. If an Application is deleted and recreated, for example by the ApplicationSet after a rename, it starts on `latest` and gets its `sha-*` tag back within 2 minutes. Again, `latest` is the same build, so nothing visible changes.

It also changes how rollback works. Setting a tag by hand, or pressing "Rollback" in the Argo CD interface, does not stick: Image Updater moves it back to the newest build within 2 minutes. To roll back fast, re-run the last good build in GitHub Actions; it becomes the most recently built `sha-*` image and is deployed again. Then revert the bad change in git, or the next merge brings it back.

### `latest` as the default tag

The chart's default tag is `latest` and the workflow pushes it on every build. A brand-new app therefore works before Image Updater has ever looked at it, and the recreate case above is harmless. Production never *chooses* `latest` once Image Updater has run; it is the floor the app stands on until then.

### One ImageUpdater resource for every app

Since version 1.0, Image Updater is configured with `ImageUpdater` objects rather than only annotations. There is exactly one, `mansus-apps`. It selects every Application labelled `mansus.org/app-platform: "true"` and reads the details from annotations on each Application: image name, `newest-build` strategy, the `sha-*` filter, the two Helm parameter names, and write-back `argocd`. The ApplicationSet template writes that label and those annotations. A new repository therefore needs no Image Updater configuration at all.

### Disks are never deleted automatically

A production PVC carries two annotations: `helm.sh/resource-policy: keep` and `argocd.argoproj.io/sync-options: Prune=false,Delete=false`. Removing the app, renaming the disk or turning `persistence` off leaves the disk and its data in place. When an app is removed (by deleting its `.k3s/values.yaml`), its namespace stays too, because of the `CreateNamespace` rule. Deleting the namespace by hand is the one step that destroys the data, so a person has to take it. Previews leave out both annotations, which is why their disks go with the PR.

### Repository names become Kubernetes names

The Application, the namespace and every object are named after the repository in lower case. Kubernetes names allow lower-case letters, digits and `-`, at most 63 characters. A repository with `.` or `_` in its name cannot deploy. That is why the example is called `hello-k3s` and only its host is `hello.mansus.org`: a repository called `hello.mansus.org` would need a namespace with dots in it.

The chart's selector label is plain `app: <name>`. It matches the label the cluster's older hand-written manifests used, so the chart can take over an existing Deployment (selectors cannot be changed after creation). That is how relay moved onto the platform: it kept its namespace and names, and the new Application adopted the running Deployment, disk and certificate instead of creating new ones.

### Two kinds of GitHub token

::: note 5
GitHub has two kinds of personal token. *Classic* tokens have broad scopes such as `repo` or `read:packages`. *Fine-grained* tokens are limited to one owner, chosen repositories and specific permissions.
:::

The platform needs to read the org's repositories and pull requests, and to read images on GHCR.[^5] They are separate tokens for a reason: fine-grained tokens cannot read GHCR, so the image token has to be classic. Every token is stored as a SealedSecret in the configuration repository.

| Token | Kind and permissions | Used by |
| --- | --- | --- |
| Token A | fine-grained, `mansus-org` only, all repositories: Contents, Metadata and Pull requests, read-only | ApplicationSet org scan and PR listing; Argo CD cloning any `mansus-org` repository |
| Token B | classic, only `read:packages` | Image Updater reading tags; every app pod pulling its image (the cluster-wide `ghcr-pull`) |
| ARC credential | classic, `repo` scope | ARC registering runners with the org |
| `GITHUB_TOKEN` | per job, `packages: write` | the workflow pushing images |

Token A covers private repositories too, which is why a private app deploys the same way as a public one. Token B is sealed twice: once for Image Updater in the `argocd` namespace, and once cluster-wide inside the chart's defaults. Both tokens expire; rotating one means sealing the new value and committing it, and Argo CD picks it up within minutes.

### Public repositories and the runner group

Organisation runners are not available to public repositories unless their runner group allows it. Relay and Revolution are public, so the org's `Default` runner group has `allows_public_repositories` turned on. Without it, jobs from public repositories queue forever while private ones run, which is a confusing failure to debug. The fork rule in the `preview` job is what keeps this setting safe.

## Adding a repository, and finding what went wrong

### The checklist

1. The repository is in `mansus-org` and its name uses only lower-case letters, digits and `-`.
2. A `Dockerfile` at the root builds a web server that listens on one port.
3. `.k3s/values.yaml` and `.github/workflows/deploy.yml` are copied from `templates/app-repo/` in the configuration repository. Set `ingress.host`, `port` and `healthCheck.path`. Everything else has a default: environment variables, a disk, more memory, extra arguments, sealed secrets.
4. DNS: an `A` record for the host pointing at the server, where the other `*.mansus.org` names point. Check it with `dig` before merging. If DNS was wrong at deploy time, fix it; cert-manager retries on its own.
5. Open a pull request with those files and merge it. That first one gets no preview. From then on every merge deploys itself and every PR gets a preview.

Removing an app is the reverse: delete `.k3s/values.yaml` from `main`. Within 3 minutes the Application and what it made are gone, except disks and the namespace.

### Five stages to check

A deploy passes five stages, and debugging means finding the first one that broke:

```from merge to live
1 build ran  →  2 image on GHCR  →  3 Application exists  →  4 Image Updater set the tag  →  5 pod running, HTTPS works
```

1. **The build.** The repository's Actions tab, or `gh run list --workflow deploy.yml`. A run stuck in *Queued* means no runner took it: three already busy, the node out of memory, or a public repository and the runner-group setting.
2. **The image.** The package page on GitHub should show `sha-<7>` for the head of `main`, next to `latest`.
3. **The Application.** `kubectl get application <repo> -n argocd` should say `Synced` and `Healthy`. If it does not exist, the ApplicationSet's conditions say why: `kubectl get applicationset mansus-apps -n argocd -o yaml`, under `status.conditions`. An expired token shows up as `401 Bad credentials`; a typo in the values file as a schema error that names the key.
4. **The tag.** The Application's `spec.sources[0].helm.parameters` shows which tag Image Updater set, and its log has a line per update. A tag that flips back and forth means two writers, and that `ignoreApplicationDifferences` has gone missing.
5. **The pod and the certificate.** `kubectl get pods,certificate -n <repo>`. `ImagePullBackOff` means no image or no pull secret; `CrashLoopBackOff` means read the logs; `Running` but not ready means the port or health-check path is wrong; a certificate stuck at `READY False` means DNS does not point at the server yet.

The Argo CD web interface shows stages 3 to 5 in one place: every Application, its sync and health state, and a diff per object between git and the cluster. Generated apps appear next to the hand-written ones. To skip the 3- and 2-minute timers, annotate the ApplicationSet with `argocd.argoproj.io/application-set-refresh=true` and it rescans at once.

## Limits, and what comes next

The platform does what it promises. Merging to `main` in hello-k3s, relay or this site is the whole release process, and pull requests get previews nobody has to ask for. It is also small and fragile in ways that matter more as more apps move onto it.

- **One node.** Every app, the runners, Argo CD and the shared Postgres run on one machine. If it goes down, everything does, and nothing moves elsewhere. A second node would bring its own problems, since today's disks are local folders that only one node can see.
- **Backups.** Disks are carefully never deleted, but that is not the same as being backed up. The shared Postgres lives on the node's disk. The Sealed Secrets private key also needs a safe copy: without it, no sealed value in any repository can ever be decrypted again.
- **Secrets in previews.** Cluster-wide sealing works but is broad. A per-preview mechanism would be better.
- **Old images.** Neither `sha-*` nor `pr-*` images are deleted on GHCR. Closed pull requests leave images behind.
- **Silent failures.** A failed sync, an expired token or a stuck certificate shows up in Argo CD and in logs, but nothing tells anyone. Today you find out when the site does not change.

None of these needs a new design, just someone who has done it before. The list below says where help would land.
