---
title: "Hyperautomation: GitOps deploys for every repo in your org with Argo CD"
title_es: "Hiperautomatización: despliegues GitOps para cada repositorio de tu organización con Argo CD"
dek: A step-by-step guide. One server, one GitHub org, and at the end any repo with a small values file deploys itself on merge to main, at its own HTTPS address, with a preview for every pull request.
dek_es: Una guía paso a paso. Un servidor, una organización de GitHub, y al final cualquier repositorio con un pequeño fichero de valores se despliega solo al hacer merge a main, con su propia dirección HTTPS y una vista previa para cada pull request.
summary: "How to build it yourself: k3s, Argo CD, an ApplicationSet that scans your GitHub org, Image Updater and one shared Helm chart. Merge, and it's live."
summary_es: "Cómo montarlo tú mismo: k3s, Argo CD, un ApplicationSet que recorre tu organización de GitHub, Image Updater y un chart de Helm compartido. Haces merge y está publicado."
category: architecture
number: 6
date: 2026-10-29
needs_summary: people who follow this guide on their own server and tell us where it broke
needs_summary_es: gente que siga esta guía en su propio servidor y nos cuente dónde falló
needs_label: tell us
needs_label_es: cuéntanos
handover: If you build this, tell us which step failed for you and how you fixed it. These improvements would help everyone who follows it.
handover_es: Si lo montas, cuéntanos qué paso te falló y cómo lo arreglaste. Estas mejoras ayudarían a todos los que lo sigan.
needs:
  - Reports of steps that failed when you replicated this, with the error and the fix
  - A second node, so one machine going down does not take every app with it
  - Backups of app disks and the Sealed Secrets key, tested by actually restoring them
  - Automatic cleanup of old images on GHCR, starting with closed pull requests' pr-* tags
  - A safer way to give previews their own secrets than sealing them cluster-wide
  - Alerts when a build, a sync or a certificate fails, instead of finding out in the browser
needs_es:
  - Informes de los pasos que fallaron al replicarlo, con el error y el arreglo
  - Un segundo nodo, para que una máquina caída no se lleve todas las apps
  - Copias de seguridad de los discos de las apps y de la clave de Sealed Secrets, probadas restaurándolas
  - Limpieza automática de imágenes viejas en GHCR, empezando por las etiquetas pr-* de pull requests cerradas
  - Una forma más segura de dar secretos propios a las vistas previas que sellarlos para todo el clúster
  - Alertas cuando falla una compilación, una sincronización o un certificado, en vez de enterarse en el navegador
---

## What you'll build

At the end of this guide, any repository in your GitHub organisation can deploy itself to your server. It needs three files: a `Dockerfile`, a short `.k3s/values.yaml` that names its web address, and a standard workflow. Then:

- **Merge to `main`, and it's live in minutes** at its own HTTPS address. Nobody runs a command or edits a config repo.
- **Open a pull request, and it gets a preview URL**, `https://<repo>-pr-<number>.<your-domain>`, deleted when the PR closes.
- **Zero per-app operations.** No pipeline to write, no secret to add, no DNS ticket if you use a wildcard record.

::: pull
Merge, and a few minutes later it is live. Nobody touches the cluster's repository for a release.
:::

::: figure Fig. 1
![Map of the platform in three bands. Build: the hello-k3s repo runs a workflow on an ARC runner, which pushes a sha tag to GHCR. Deploy: an org scan feeds the ApplicationSet, which creates an Application; Image Updater sees the new tag and sets image.tag on the Application; Argo CD renders charts/app. Serve: Argo CD syncs the hello-k3s pod, which Traefik reaches through a Service, and cert-manager gives Traefik the TLS certificate.](/articles/images/k3s-platform-map.png){colour wide}
The whole platform, drawn for the worked example used in this guide, hello-k3s. Build happens in GitHub and on runners inside the cluster, deploy is Argo CD and its helpers, serving is Traefik with certificates from cert-manager. The diagrams were made with [Archify](https://github.com/tt-a1i/archify); click or tap one to open it full size.
:::

For example, we run this for the mansus-org GitHub org. [hello-k3s](https://github.com/mansus-org/hello-k3s), the smallest app that works, is live at <https://hello.mansus.org>, and this site deploys the same way. Every manifest below is copied from our setup, with our names replaced by placeholders.

### What you need

- **A Linux server** with 2 or more vCPUs, 4 GB of RAM and a public IP. Any VPS works; builds run on it too, so more memory helps.
- **A domain** where you can add DNS records. Best: a wildcard `A` record, `*.<your-domain>`, pointing at the server. Without it you add one record per app and previews won't get addresses.
- **A GitHub organisation** you administer.
- **A git repository for the cluster's configuration**, `<your-gitops-repo>`, in that org. We call it the gitops repo.
- **On your laptop:** `kubectl`, `helm`, `kubeseal` (from the [Sealed Secrets releases](https://github.com/bitnami-labs/sealed-secrets/releases)), `yq`, and `gh`, the GitHub CLI, logged in as an org owner.

Placeholders look like `<your-org>`, `<your-domain>`, `<your-gitops-repo>` and `<you@example.com>`. Replace them everywhere. Write `<your-org>` in lower case: image names must be lower case.

## How it works in one minute

::: figure Fig. 2
![Sequence from merge to live. Build: GitHub runs deploy.yml on an ARC runner, which pushes sha-afb4504 and latest to GHCR. Discover, first deploy only: the ApplicationSet lists repos, finds hello-k3s has .k3s/values.yaml and creates Application hello-k3s. Roll out: Image Updater lists tags every 2 minutes, gets the newest sha tag and sets the image.tag parameter; Argo CD applies the rendered chart to the k3s node. TLS, first deploy only: the Ingress carries the cluster-issuer annotation, cert-manager orders a certificate for hello.mansus.org, Let's Encrypt checks HTTP-01 through Traefik and the certificate is stored.](/articles/images/k3s-merge-to-live.png){colour wide}
The worked example: a merge in hello-k3s becoming https://hello.mansus.org. Discovery and the certificate only happen the first time.
:::

1. **Build.** A merge to `main` runs the repo's `deploy` workflow on a runner inside your cluster. It pushes the image to GHCR, GitHub's container registry, as `sha-<7 chars of the commit>` and `latest`.
2. **Discover.** An Argo CD **ApplicationSet** scans your org every 3 minutes. Each repo with `.k3s/values.yaml` on its default branch gets one Argo CD **Application**, named after the repo.
3. **Pick the tag.** **Argo CD Image Updater** checks GHCR every 2 minutes and sets the newest `sha-*` tag on the Application.
4. **Render and apply.** Argo CD renders one shared **Helm chart** with the repo's values file and that tag, and applies the result: a Deployment, a Service and an Ingress.
5. **Serve.** Traefik routes the host to the app. cert-manager gets it a Let's Encrypt certificate.

This is **GitOps**: git holds the desired state and a controller inside the cluster pulls it and applies it. Nothing outside the cluster needs credentials to it. CI only pushes an image; the cluster decides to run it. You can delete and rebuild the cluster from the gitops repo.

Words used below: an **Application** is Argo CD's unit, "render these manifests from this repo into this namespace". An **ApplicationSet** is a factory that stamps out Applications from a list. A **namespace** is a folder for Kubernetes objects; each app gets its own.

## Install k3s and open the firewall

[k3s](https://k3s.io/) is a small Kubernetes distribution: one binary, little memory. It ships with Traefik, the reverse proxy that listens on ports 80 and 443 and routes requests by host name. On the server:

```on the server
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes
```

Open 80 and 443 to the world, and the Kubernetes API (6443) only to your own IP. With `ufw`; a cloud firewall works the same:

```on the server: firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from <your-laptop-ip> to any port 6443 proto tcp
# k3s pod and service networks (from the k3s docs)
sudo ufw allow from 10.42.0.0/16 to any
sudo ufw allow from 10.43.0.0/16 to any
sudo ufw enable
```

Copy the kubeconfig to your laptop and point it at the server:

```on your laptop
ssh <you>@<server-ip> sudo cat /etc/rancher/k3s/k3s.yaml > ~/.kube/k3s.yaml
sed -i 's/127.0.0.1/<server-ip>/' ~/.kube/k3s.yaml
chmod 600 ~/.kube/k3s.yaml
export KUBECONFIG=~/.kube/k3s.yaml
```

Add DNS: `*.<your-domain>` as an `A` record to the server's IP.

**Check:** `kubectl get nodes` on your laptop shows one node `Ready`, and `kubectl -n kube-system get pods` shows `traefik` running. `dig +short anything.<your-domain>` prints the server's IP.

## Install Argo CD and the root app

[Argo CD](https://argo-cd.readthedocs.io/) makes the cluster match a git repo. Install it with the official manifest. `--server-side` is needed because some of its CRDs are too large for a client-side apply:

```install Argo CD
kubectl create namespace argocd
kubectl apply -n argocd --server-side --force-conflicts \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

The platform needs Argo CD 2.10 or newer; `stable` is 3.x.

Now the "app of apps": one Application, `root-app`, that watches the `apps/` folder of your gitops repo. Every file you put in `apps/` is itself an Application, and Argo CD installs it. From here on, you install things by committing a file.

Create the gitops repo with this layout. The rest of the guide fills it in:

```<your-gitops-repo>, at the end
root-app.yaml
apps/          one Argo CD Application or ApplicationSet per file
deploy/        plain manifests some of those Applications point at
charts/app/    the shared Helm chart
```

```root-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/<your-gitops-repo>.git
    targetRevision: HEAD
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true     # delete what was removed from git
      selfHeal: true  # undo changes made by hand
```

If the gitops repo is public, apply it now. It only ever holds sealed (encrypted) secrets, so public is fine. If it is private, Argo CD can't read it yet: do the tokens section first, apply its `github-repo-creds` command with `kubectl apply` instead of sealing, then come back.

```bootstrap
kubectl apply -f root-app.yaml
```

Argo CD polls git every 3 minutes. To open its UI:

```Argo CD UI
argocd admin initial-password -n argocd     # or read the argocd-initial-admin-secret Secret
kubectl port-forward svc/argocd-server -n argocd 8080:443   # https://localhost:8080, user admin
```

**Check:** `kubectl get application root-app -n argocd` says `Synced` and `Healthy` (with an empty `apps/`, it has nothing to do).

## Install Sealed Secrets

With GitOps everything goes into git, and plain Kubernetes Secrets can't. [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) fixes that. A controller in the cluster holds a private key. `kubeseal` encrypts ("seals") a secret with the matching public key, and only the controller can decrypt it. A `SealedSecret` is safe to commit.

```apps/sealed-secrets.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: sealed-secrets
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://bitnami.github.io/sealed-secrets
    chart: sealed-secrets
    targetRevision: 2.19.3
    helm:
      values: |
        fullnameOverride: sealed-secrets-controller
        resources:
          requests: { cpu: 20m, memory: 32Mi }
          limits: { cpu: 200m, memory: 128Mi }
  destination:
    server: https://kubernetes.default.svc
    namespace: kube-system
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Commit and push. A sealed value is bound to a place. The default *strict* scope means one name in one namespace; `--scope cluster-wide` means anywhere. That matters for previews later.

**Check:** `kubectl -n kube-system get pods | grep sealed-secrets` shows `Running`, and `kubeseal --fetch-cert` prints a certificate.

Back up the controller's key now (`kubectl -n kube-system get secret -l sealedsecrets.bitnami.com/sealed-secrets-key -o yaml`) and keep it somewhere safe. Without it, nothing you seal can ever be decrypted on a new cluster.

## Install cert-manager and Let's Encrypt issuers

[cert-manager](https://cert-manager.io/) gets a free certificate from [Let's Encrypt](https://letsencrypt.org/) for every host an Ingress names, and renews it. We use the **HTTP-01** challenge: Let's Encrypt fetches a token from `http://<host>/.well-known/acme-challenge/…` and Traefik serves it. It needs nothing but working DNS.

```apps/cert-manager.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cert-manager
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://charts.jetstack.io
    chart: cert-manager
    targetRevision: v1.14.0   # the version we tested; newer charts use crds.enabled instead
    helm:
      parameters:
        - name: installCRDs
          value: "true"
  destination:
    server: https://kubernetes.default.svc
    namespace: cert-manager
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Two issuers: staging for testing (high rate limits, untrusted certificates) and production.

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
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: <you@example.com>
    privateKeySecretRef:
      name: letsencrypt-staging
    solvers:
      - http01:
          ingress:
            class: traefik
```

```apps/cert-manager-config.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cert-manager-config
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/<your-gitops-repo>.git
    targetRevision: HEAD
    path: deploy/cert-manager
  destination:
    server: https://kubernetes.default.svc
    namespace: cert-manager
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    # The ClusterIssuer CRD comes from cert-manager; retry until it exists.
    retry:
      limit: 5
      backoff: { duration: 30s, factor: 2, maxDuration: 5m }
```

**Check:** `kubectl get clusterissuers` lists both with `READY True`.

## Create and seal the GitHub tokens

The cluster needs to read your org's repos and pull requests, and to read images on GHCR. That takes two tokens, because fine-grained tokens can't read GHCR.

| Token | Kind and permissions | Used by |
| --- | --- | --- |
| Token A | fine-grained, owner `<your-org>`, all repositories: Contents, Metadata, Pull requests, all read-only | the ApplicationSets (org scan, PR list) and Argo CD cloning app repos |
| Token B | classic, only `read:packages` | Image Updater reading tags, and every pod pulling its image |

**Token A.** Open <https://github.com/settings/personal-access-tokens/new>. Resource owner: your org. Repository access: **All repositories**. Repository permissions: **Contents**, **Metadata** and **Pull requests**, all **Read-only**, nothing else. If your org requires approval for fine-grained tokens, approve it under the org's Settings → Personal access tokens.

**Token B.** Open <https://github.com/settings/tokens/new>. Tick only **`read:packages`**.

Both expire. Put a reminder in your calendar a week before.

Seal them into the gitops repo. The tokens are read without echoing and never written to disk unencrypted:

```seal the tokens (from the gitops repo root)
read -rsp 'Token A (github_pat_...): ' GH_TOKEN; echo
read -rsp 'Token B (ghp_...): ' GHCR_TOKEN; echo
GH_USER=<your-github-username>
ORG=<your-org>
mkdir -p deploy/platform
SEAL="kubeseal --controller-name sealed-secrets-controller --controller-namespace kube-system --format yaml"

# Token A for the ApplicationSet org scan. The scm-creds label is required.
kubectl create secret generic github-scm -n argocd \
  --from-literal=token="$GH_TOKEN" --dry-run=client -o yaml \
  | kubectl label --local -f - argocd.argoproj.io/secret-type=scm-creds -o yaml \
  | $SEAL > deploy/platform/github-scm.yaml

# Token A again: clone credentials for every https://github.com/<your-org>/* repo
kubectl create secret generic github-repo-creds -n argocd \
  --from-literal=type=git \
  --from-literal=url=https://github.com/$ORG \
  --from-literal=username=x-access-token \
  --from-literal=password="$GH_TOKEN" --dry-run=client -o yaml \
  | kubectl label --local -f - argocd.argoproj.io/secret-type=repo-creds -o yaml \
  | $SEAL > deploy/platform/github-repo-creds.yaml

# Token B for Image Updater, in the argocd namespace
kubectl create secret docker-registry ghcr-pull -n argocd \
  --docker-server=ghcr.io --docker-username="$GH_USER" \
  --docker-password="$GHCR_TOKEN" --dry-run=client -o yaml \
  | $SEAL > deploy/platform/ghcr-pull.yaml

# Token B again, cluster-wide, for pods pulling images. Keep the printed value:
# it goes into the chart's values.yaml.
kubectl create secret docker-registry ghcr-pull -n placeholder \
  --docker-server=ghcr.io --docker-username="$GH_USER" \
  --docker-password="$GHCR_TOKEN" --dry-run=client -o yaml \
  | $SEAL --scope cluster-wide \
  | yq '.spec.encryptedData[".dockerconfigjson"]'

unset GH_TOKEN GHCR_TOKEN
```

```apps/platform.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: platform
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/<your-gitops-repo>.git
    targetRevision: HEAD
    path: deploy/platform
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Before you commit, make sure no plain token slipped in: `grep -rlE 'github_pat_|ghp_' deploy/ || echo clean`.

**Check:** `kubectl get secret -n argocd github-scm github-repo-creds ghcr-pull` lists all three. And Token A sees private repos: `GH_TOKEN=<token-a> gh api orgs/<your-org>/repos --jq '.[].full_name'`.

## Run GitHub Actions runners inside the cluster

[Actions Runner Controller](https://github.com/actions/actions-runner-controller) (ARC) runs your org's Actions jobs as pods in the cluster. A listener pod waits for jobs with `runs-on: arc-runner`, starts a runner pod per job and deletes it after. At most 3 at once, none when idle. Each runner uses Docker-in-Docker (a second container with its own Docker daemon), so `docker build` works inside a pod.

ARC registers with GitHub using a third credential. Create a classic token with the **`admin:org`** scope, which GitHub's ARC docs require for organisation runners (a GitHub App works too), and seal it next to the others. The namespace file makes sure `arc-runners` exists before the secret lands in it:

```seal the runner token
read -rsp 'Runner token (ghp_...): ' ARC_TOKEN; echo
kubectl create secret generic arc-github-secret -n arc-runners \
  --from-literal=github_token="$ARC_TOKEN" --dry-run=client -o yaml \
  | kubeseal --controller-name sealed-secrets-controller \
      --controller-namespace kube-system --format yaml \
  > deploy/platform/arc-github-secret.yaml
unset ARC_TOKEN
```

```deploy/platform/arc-runners-namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: arc-runners
```

ARC's charts are published as OCI images on ghcr.io. Argo CD needs to be told that, with a repository Secret. It holds no credentials, so it can be committed as it is:

```deploy/platform/arc-helm-repo.yaml
apiVersion: v1
kind: Secret
metadata:
  name: arc-helm-repo
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
stringData:
  name: arc
  type: helm
  url: ghcr.io/actions/actions-runner-controller-charts
  enableOCI: "true"
```

Then the controller and the scale set. Versions are the ones we tested:

```apps/arc-runner-controller.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: arc-runner-controller
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ghcr.io/actions/actions-runner-controller-charts
    chart: gha-runner-scale-set-controller
    targetRevision: 0.14.2
    helm:
      values: |
        resources:
          requests: { cpu: 20m, memory: 32Mi }
          limits: { cpu: 100m, memory: 128Mi }
  destination:
    server: https://kubernetes.default.svc
    namespace: arc-systems
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

```apps/arc-runner.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: arc-runner        # also the runs-on label
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ghcr.io/actions/actions-runner-controller-charts
    chart: gha-runner-scale-set
    targetRevision: 0.14.2
    helm:
      values: |
        githubConfigUrl: https://github.com/<your-org>
        githubConfigSecret: arc-github-secret
        maxRunners: 3
        minRunners: 0
        runnerGroup: default
        controllerServiceAccount:
          namespace: arc-systems
          name: arc-runner-controller-gha-rs-controller
        containerMode:
          type: dind
        template:
          spec:
            containers:
              - name: runner
                image: ghcr.io/actions/actions-runner:latest
                command: ["/home/runner/run.sh"]
                resources:
                  requests: { cpu: 250m, memory: 256Mi }
                  limits: { cpu: 1000m, memory: 1Gi }
  destination:
    server: https://kubernetes.default.svc
    namespace: arc-runners
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

Organisation runners don't serve public repos unless their runner group allows it. Allow it, or public repos queue forever:

```allow public repos on the Default runner group
gh api orgs/<your-org>/actions/runner-groups \
  --jq '.runner_groups[] | "\(.id) \(.name) public=\(.allows_public_repositories)"'
gh api -X PATCH orgs/<your-org>/actions/runner-groups/1 -F allows_public_repositories=true
```

This is safe only because the workflow never builds pull requests from forks; see *Why it's built this way*.

**Check:** `kubectl get pods -n arc-systems` shows the controller and a listener `Running`, and your org's Settings → Actions → Runners lists `arc-runner`.

## The shared Helm chart

::: figure Fig. 3
![Tree of objects. Application hello-k3s owns namespace hello-k3s, which holds Deployment hello-k3s, Service hello-k3s on port 8080, Ingress hello.mansus.org with its Secret hello-k3s-tls, and SealedSecret ghcr-pull with the Secret ghcr-pull it unseals into.](/articles/images/k3s-hello-resources.png){colour wide}
The worked example: everything Argo CD keeps in sync for hello-k3s. The two Secrets at the bottom are made by cert-manager and the Sealed Secrets controller, not rendered by the chart.
:::

[Helm](https://helm.sh/) renders Kubernetes YAML from templates and a `values.yaml` of defaults. Every app uses this one chart, in `charts/app/` of the gitops repo. It turns a values file of a few lines into a Deployment, a Service, an Ingress with a certificate, a pull secret and, if asked, a disk. Resource names come from the Helm release name, which the ApplicationSet sets to the repo name.

It is trimmed from ours: one container, one port, web traffic. Paste the value you printed in the tokens step into `encryptedDockerConfigJson`.

```charts/app/Chart.yaml
apiVersion: v2
name: app
description: One web container behind Traefik, with a cert-manager certificate.
type: application
version: 0.1.0
```

```charts/app/values.yaml
# Defaults for every app. An app's .k3s/values.yaml overrides what it needs.
image:
  # Empty = <registry>/<release name>. Image Updater and the preview
  # ApplicationSet set repository and tag as Helm parameters.
  registry: ghcr.io/<your-org>
  repository: ""
  tag: latest

registry:
  pullSecret:
    # Renders SealedSecret "ghcr-pull" (Token B, sealed cluster-wide) in
    # every app namespace, so private images just pull.
    enabled: true
    encryptedDockerConfigJson: <sealed Token B, see the tokens step>

replicas: 1
port: 8080

# Plain values, or a valueFrom object:
#   DATABASE_URL: { secretKeyRef: { name: myapp-secrets, key: DATABASE_URL } }
env: {}
# Secrets whose keys all become env vars.
envFromSecrets: []
# SealedSecrets rendered into the app namespace:
#   - name: myapp-secrets
#     scope: cluster-wide        # only if sealed with --scope cluster-wide
#     encryptedData: { DATABASE_URL: AgB... }
sealedSecrets: []

ingress:
  enabled: true
  host: ""            # required, e.g. myapp.<your-domain>
  extraHosts: []      # more names on the same certificate
  clusterIssuer: letsencrypt-prod

persistence:
  enabled: false
  size: 1Gi
  storageClass: ""    # empty = cluster default (k3s: local-path)
  mountPath: /data

healthCheck:
  path: /             # empty = TCP check on the port

resources:
  requests: { cpu: 50m, memory: 64Mi }
  limits: { cpu: 500m, memory: 256Mi }

# Set by the preview ApplicationSet, never in .k3s/values.yaml.
preview:
  enabled: false
  resources:
    requests: { cpu: 10m, memory: 32Mi }
  # Used instead of sealedSecrets in previews when not empty.
  sealedSecrets: []
```

```charts/app/templates/_helpers.tpl
{{- define "app.name" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "app.selectorLabels" -}}
app: {{ include "app.name" . }}
{{- end -}}

{{- define "app.labels" -}}
{{ include "app.selectorLabels" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "app.image" -}}
{{- $repo := .Values.image.repository | default (printf "%s/%s" .Values.image.registry .Release.Name) -}}
{{- printf "%s:%s" $repo (toString .Values.image.tag) -}}
{{- end -}}

{{/* Previews reserve less, but keep the production limits. */}}
{{- define "app.resources" -}}
{{- if .Values.preview.enabled -}}
{{- toYaml (mergeOverwrite (deepCopy .Values.resources) .Values.preview.resources) -}}
{{- else -}}
{{- toYaml .Values.resources -}}
{{- end -}}
{{- end -}}
```

```charts/app/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "app.name" . }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  replicas: {{ if .Values.preview.enabled }}1{{ else }}{{ .Values.replicas }}{{ end }}
  revisionHistoryLimit: 3
  strategy:
    # A ReadWriteOnce disk can be mounted by one pod at a time.
    type: {{ if .Values.persistence.enabled }}Recreate{{ else }}RollingUpdate{{ end }}
  selector:
    matchLabels:
      {{- include "app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "app.labels" . | nindent 8 }}
    spec:
      {{- if .Values.registry.pullSecret.enabled }}
      imagePullSecrets:
        - name: ghcr-pull
      {{- end }}
      containers:
        - name: {{ include "app.name" . }}
          image: {{ include "app.image" . }}
          # "latest" can point at a new build; sha-* and pr-* tags never change.
          imagePullPolicy: {{ eq (toString .Values.image.tag) "latest" | ternary "Always" "IfNotPresent" }}
          {{- with .Values.env }}
          env:
            {{- range $name, $value := . }}
            - name: {{ $name }}
              {{- if kindIs "map" $value }}
              valueFrom:
                {{- toYaml $value | nindent 16 }}
              {{- else }}
              value: {{ toString $value | quote }}
              {{- end }}
            {{- end }}
          {{- end }}
          {{- with .Values.envFromSecrets }}
          envFrom:
            {{- range . }}
            - secretRef:
                name: {{ . }}
            {{- end }}
          {{- end }}
          ports:
            - name: http
              containerPort: {{ .Values.port }}
          {{- $check := dict "tcpSocket" (dict "port" "http") }}
          {{- if .Values.healthCheck.path }}
          {{- $check = dict "httpGet" (dict "path" .Values.healthCheck.path "port" "http") }}
          {{- end }}
          readinessProbe:
            {{- toYaml $check | nindent 12 }}
            initialDelaySeconds: 3
          livenessProbe:
            {{- toYaml $check | nindent 12 }}
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            {{- include "app.resources" . | nindent 12 }}
          {{- if .Values.persistence.enabled }}
          volumeMounts:
            - name: data
              mountPath: {{ .Values.persistence.mountPath }}
          {{- end }}
      {{- if .Values.persistence.enabled }}
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: {{ include "app.name" . }}-data
      {{- end }}
```

```charts/app/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ include "app.name" . }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
spec:
  selector:
    {{- include "app.selectorLabels" . | nindent 4 }}
  ports:
    - name: http
      port: {{ .Values.port }}
      targetPort: http
```

```charts/app/templates/ingress.yaml
{{- if .Values.ingress.enabled }}
{{- /* A preview must never answer for production's extra hosts. */}}
{{- $extra := ternary (list) .Values.ingress.extraHosts .Values.preview.enabled }}
{{- $hosts := prepend $extra (required "ingress.host is required" .Values.ingress.host) }}
{{- $name := include "app.name" . }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ $name }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
  annotations:
    cert-manager.io/cluster-issuer: {{ .Values.ingress.clusterIssuer }}
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        {{- range $hosts }}
        - {{ . }}
        {{- end }}
      secretName: {{ $name }}-tls
  rules:
    {{- range $hosts }}
    - host: {{ . }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ $name }}
                port:
                  number: {{ $.Values.port }}
    {{- end }}
{{- end }}
```

```charts/app/templates/ghcr-pull-sealedsecret.yaml
{{- if .Values.registry.pullSecret.enabled }}
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: ghcr-pull
  labels:
    {{- include "app.labels" . | nindent 4 }}
  annotations:
    sealedsecrets.bitnami.com/cluster-wide: "true"
spec:
  encryptedData:
    .dockerconfigjson: {{ .Values.registry.pullSecret.encryptedDockerConfigJson }}
  template:
    metadata:
      name: ghcr-pull
      annotations:
        sealedsecrets.bitnami.com/cluster-wide: "true"
    type: kubernetes.io/dockerconfigjson
{{- end }}
```

```charts/app/templates/sealedsecrets.yaml
{{- $list := .Values.sealedSecrets }}
{{- if and .Values.preview.enabled .Values.preview.sealedSecrets }}
{{- $list = .Values.preview.sealedSecrets }}
{{- end }}
{{- range $list }}
---
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: {{ .name }}
  labels:
    {{- include "app.labels" $ | nindent 4 }}
  {{- with .scope }}
  annotations:
    sealedsecrets.bitnami.com/{{ . }}: "true"
  {{- end }}
spec:
  encryptedData:
    {{- toYaml .encryptedData | nindent 4 }}
  template:
    metadata:
      name: {{ .name }}
      {{- with .scope }}
      annotations:
        sealedsecrets.bitnami.com/{{ . }}: "true"
      {{- end }}
    type: {{ .type | default "Opaque" }}
{{- end }}
```

```charts/app/templates/pvc.yaml
{{- if .Values.persistence.enabled }}
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "app.name" . }}-data
  labels:
    {{- include "app.labels" . | nindent 4 }}
  {{- if not .Values.preview.enabled }}
  annotations:
    # Production data survives syncs, chart changes and the app's removal.
    helm.sh/resource-policy: keep
    argocd.argoproj.io/sync-options: Prune=false,Delete=false
  {{- end }}
spec:
  accessModes: [ReadWriteOnce]
  {{- with .Values.persistence.storageClass }}
  storageClassName: {{ . }}
  {{- end }}
  resources:
    requests:
      storage: {{ .Values.persistence.size }}
{{- end }}
```

```charts/app/templates/namespace.yaml
{{- /* Previews own their namespace, so deleting the Application deletes it. */}}
{{- if .Values.preview.enabled }}
apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Release.Namespace }}
  labels:
    {{- include "app.labels" . | nindent 4 }}
{{- end }}
```

Our own chart adds a `values.schema.json`, so a typo like `ingres:` fails the sync with an error naming the key instead of being ignored. Worth adding once you have apps.

**Check:** render it locally with an app's values. You should see a Service, a Deployment, an Ingress and a SealedSecret:

```render the chart
helm template hello-k3s charts/app -n hello-k3s --set ingress.host=hello.<your-domain> | grep '^kind:'
```

## The ApplicationSet that scans your org

This is the heart of it. The `scmProvider` generator asks GitHub for every repo in your org and keeps those whose default branch has `.k3s/values.yaml`. Each one becomes an Application named after the repo, deploying into a namespace of the same name. Delete the file from a repo, and its Application goes away on the next scan.

The Application has two *sources*. Source 0 is the shared chart from the gitops repo. Source 1 is the app's own repo, used only as a reference named `values`, so source 0 can load `$values/.k3s/values.yaml`. The annotations are instructions for Image Updater, installed in the next step.

```apps/org-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: org-apps
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - scmProvider:
        requeueAfterSeconds: 180     # rescan every 3 minutes (default 30)
        cloneProtocol: https
        github:
          organization: <your-org>
          tokenRef:
            secretName: github-scm
            key: token
        filters:
          - pathsExist: [.k3s/values.yaml]
  # Image Updater writes the tag into spec.sources[0].helm.parameters.
  # Without this, the ApplicationSet would put the template back on its
  # next pass and roll the app back to "latest".
  ignoreApplicationDifferences:
    - jsonPointers:
        - /spec/sources/0/helm/parameters
  template:
    metadata:
      name: '{{ .repository | lower }}'
      namespace: argocd
      labels:
        app-platform: "true"
      annotations:
        argocd-image-updater.argoproj.io/image-list: 'app=ghcr.io/<your-org>/{{ .repository | lower }}'
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
        # 0: the shared chart. Must stay first (see ignoreApplicationDifferences).
        - repoURL: https://github.com/<your-org>/<your-gitops-repo>.git
          targetRevision: HEAD
          path: charts/app
          helm:
            releaseName: '{{ .repository | lower }}'
            valueFiles:
              - $values/.k3s/values.yaml
        # 1: the app repo, only for its .k3s/values.yaml.
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
        retry:
          limit: 5
          backoff: { duration: 30s, factor: 2, maxDuration: 5m }
```

**Check:** the ApplicationSet has no error. Until a repo has `.k3s/values.yaml` it generates zero Applications, which is fine.

```check the ApplicationSet
kubectl get applicationset org-apps -n argocd \
  -o jsonpath='{range .status.conditions[*]}{.type}={.status} {.message}{"\n"}{end}'
# want: ErrorOccurred=False, ResourcesUpToDate=True
```

## Install Argo CD Image Updater

[Argo CD Image Updater](https://argocd-image-updater.readthedocs.io/) closes the gap between "a new image exists" and "the Application uses it". Every 2 minutes it lists each app's tags on GHCR, keeps those matching `sha-*`, picks the most recently built, and sets it as the `image.tag` Helm parameter on the Application. Argo CD then rolls the pod.

Since version 1.0 it is configured with `ImageUpdater` resources. You need exactly one: it selects every Application labelled `app-platform: "true"` and reads the per-app details from the annotations the ApplicationSet template wrote. A new repo needs no Image Updater configuration.

```apps/argocd-image-updater.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argocd-image-updater
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://argoproj.github.io/argo-helm
    chart: argocd-image-updater
    targetRevision: 1.3.2      # the version we tested
    helm:
      values: |
        config:
          log.level: info
          interval: 2m
          registries:
            - name: GitHub Container Registry
              api_url: https://ghcr.io
              prefix: ghcr.io
              ping: no
              credentials: pullsecret:argocd/ghcr-pull   # Token B
        resources:
          requests: { cpu: 20m, memory: 64Mi }
          limits: { cpu: 200m, memory: 256Mi }
        extraObjects:
          - apiVersion: argocd-image-updater.argoproj.io/v1alpha1
            kind: ImageUpdater
            metadata:
              name: org-apps
              namespace: argocd
              annotations:
                # The CRD is installed by this same chart.
                argocd.argoproj.io/sync-options: SkipDryRunOnMissingResource=true
            spec:
              applicationRefs:
                - namePattern: "*"
                  labelSelectors:
                    matchLabels:
                      app-platform: "true"
                  useAnnotations: true
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - ServerSideApply=true
```

**Check:** `kubectl get pods -n argocd -l app.kubernetes.io/name=argocd-image-updater` is `Running` and `kubectl get imageupdaters -n argocd` lists `org-apps`.

## A preview for every pull request

::: figure Fig. 4
![Sequence for a preview. A push to a PR branch runs the preview job on an ARC runner, which pushes pr-12-abc1234 to GHCR and posts a sticky comment with the preview URL. The mansus-previews ApplicationSet lists open PRs every 2 minutes, gets PR 12 with head abc1234 and creates Application hello-k3s-pr-12; Argo CD applies the chart with preview.enabled. When the PR is closed or merged, mansus-previews deletes the Application.](/articles/images/k3s-pr-preview.png){colour wide}
The worked example: pull request 12 in hello-k3s becoming https://hello-k3s-pr-12.mansus.org, and going away when the PR closes. Our ApplicationSet is called mansus-previews; below it is org-previews.
:::

A second ApplicationSet uses a *matrix* generator: the same org scan, crossed with a `pullRequest` generator that lists each repo's open PRs every 2 minutes. Each pair becomes an Application `<repo>-pr-<number>`. Four Helm parameters override the values file: preview mode, the image, the tag `pr-<number>-<7 chars of the head commit>` (which the workflow pushes), and the host. Repos opt out with an empty `.k3s/no-preview` file.

```apps/org-previews.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: org-previews
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - matrix:
        generators:
          - scmProvider:
              requeueAfterSeconds: 180
              cloneProtocol: https
              github:
                organization: <your-org>
                tokenRef:
                  secretName: github-scm
                  key: token
              filters:
                - pathsExist: [.k3s/values.yaml]
                  pathsDoNotExist: [.k3s/no-preview]
          # Needs "Pull requests: Read-only" on Token A.
          - pullRequest:
              requeueAfterSeconds: 120
              github:
                owner: <your-org>
                repo: '{{ .repository }}'
                tokenRef:
                  secretName: github-scm
                  key: token
  template:
    metadata:
      name: '{{ .repository | lower }}-pr-{{ .number }}'
      namespace: argocd
      # Not app-platform: Image Updater must not touch previews.
      labels:
        app-platform-preview: "true"
      finalizers:
        - resources-finalizer.argocd.argoproj.io
    spec:
      project: default
      sources:
        - repoURL: https://github.com/<your-org>/<your-gitops-repo>.git
          targetRevision: HEAD
          path: charts/app
          helm:
            releaseName: '{{ .repository | lower }}-pr-{{ .number }}'
            valueFiles:
              - $values/.k3s/values.yaml
            # These win over .k3s/values.yaml.
            parameters:
              - name: preview.enabled
                value: "true"
              - name: image.repository
                value: 'ghcr.io/<your-org>/{{ .repository | lower }}'
              - name: image.tag
                value: 'pr-{{ .number }}-{{ substr 0 7 .head_sha }}'
              - name: ingress.host
                value: '{{ .repository | lower }}-pr-{{ .number }}.<your-domain>'
        # The values file as it is in the PR's latest commit.
        - repoURL: '{{ .url }}'
          targetRevision: '{{ .head_sha }}'
          ref: values
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{ .repository | lower }}-pr-{{ .number }}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        # No CreateNamespace: the chart renders the Namespace in preview mode,
        # so deleting the Application deletes the namespace too.
        retry:
          limit: 5
          backoff: { duration: 30s, factor: 2, maxDuration: 5m }
```

When a PR closes or merges, it drops out of the open-PR list, the ApplicationSet deletes its Application, and Argo CD's resources finalizer deletes everything it made first: pod, Ingress, certificate, disk and namespace.

**Check:** `kubectl get applicationset org-previews -n argocd -o jsonpath='{.status.conditions}'` shows no `403`. A `403` means Token A lacks *Pull requests: Read-only*.

## Onboard a repo

The platform is done. Each app repo needs three things. Here are hello-k3s's real files.

**A `Dockerfile`** at the root that builds a web server listening on one port, as a non-root user. hello-k3s is busybox `httpd` serving one page:

```hello-k3s/Dockerfile
FROM busybox:stable
RUN adduser -D -u 10001 app
COPY index.html /www/index.html
USER 10001
EXPOSE 8080
CMD ["httpd", "-f", "-p", "8080", "-h", "/www"]
```

**`.k3s/values.yaml`.** Its presence turns deploys on. Set the host, the port and a path that answers 200. Everything else has a default in the chart:

```hello-k3s/.k3s/values.yaml
ingress:
  host: hello.<your-domain>

port: 8080

healthCheck:
  path: /
```

More options, all optional:

```.k3s/values.yaml, the other knobs
env:
  NODE_ENV: production
resources:
  requests: { cpu: 5m, memory: 8Mi }
  limits: { memory: 32Mi }
persistence:            # a disk that survives redeploys, never auto-deleted
  enabled: true
  size: 1Gi
  mountPath: /data
envFromSecrets: [myapp-secrets]
sealedSecrets:          # kubeseal ... -n <repo>, then paste encryptedData here
  - name: myapp-secrets
    encryptedData:
      DATABASE_URL: AgB...
```

**`.github/workflows/deploy.yml`.** The same file in every repo. On `main` it pushes `sha-<7>` and `latest`; on a PR from a branch of the same repo it pushes `pr-<number>-<7>` and posts the preview link as a comment, edited on every push. Replace `<your-domain>` once:

```.github/workflows/deploy.yml
name: deploy

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

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

      # Image names must be lowercase: ghcr.io/<org>/<repo>.
      - id: image
        shell: bash
        run: echo "name=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Tags: sha-<7 char commit> (what the cluster deploys) and latest.
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.image.outputs.name }}
          tags: |
            type=sha,prefix=sha-,format=short
            type=raw,value=latest

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=registry,ref=${{ steps.image.outputs.name }}:buildcache
          cache-to: type=registry,ref=${{ steps.image.outputs.name }}:buildcache,mode=max

  preview:
    # Branches of this repo only. A fork's code never gets built here.
    if: >-
      github.event_name == 'pull_request' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: arc-runner
    permissions:
      contents: read
      packages: write
      pull-requests: write
    steps:
      # The PR's own head commit, not the merge commit GitHub checks out by
      # default: the cluster looks for this exact sha in the tag.
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

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
            echo "url=https://${repo,,}-pr-${PR}.<your-domain>"
          } >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Reads main's cache; writes its own per-PR cache, so PR builds
      # don't overwrite main's buildcache.
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.image.outputs.name }}:${{ steps.image.outputs.tag }}
          labels: |
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.event.pull_request.head.sha }}
          cache-from: |
            type=registry,ref=${{ steps.image.outputs.name }}:buildcache
            type=gha,scope=pr-${{ github.event.pull_request.number }}
          cache-to: type=gha,scope=pr-${{ github.event.pull_request.number }},mode=max,ignore-error=true

      # One comment per PR, edited on every push.
      - uses: actions/github-script@v7
        env:
          URL: ${{ steps.image.outputs.url }}
          TAG: ${{ steps.image.outputs.tag }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        with:
          script: |
            const marker = '<!-- k3s-preview -->';
            const { URL, TAG, HEAD_SHA } = process.env;
            const body = [
              marker,
              `**Preview:** ${URL}`,
              '',
              `Image \`${TAG}\` (commit ${HEAD_SHA.slice(0, 7)}) is built. The cluster deploys it within about 2 minutes.`,
              'The preview is deleted when this PR is closed or merged.',
            ].join('\n');
            const { owner, repo } = context.repo;
            const issue_number = context.payload.pull_request.number;
            const comments = await github.paginate(github.rest.issues.listComments, { owner, repo, issue_number });
            const old = comments.find((c) => c.user.type === 'Bot' && c.body.includes(marker));
            if (old) {
              await github.rest.issues.updateComment({ owner, repo, comment_id: old.id, body });
            } else {
              await github.rest.issues.createComment({ owner, repo, issue_number, body });
            }
```

The workflow logs in with the per-job `GITHUB_TOKEN`, so an app repo holds no secrets. Name the repo with lower-case letters, digits and `-` only: it becomes a Kubernetes namespace. For example, this site's repo, [revolution](https://github.com/mansus-org/revolution), carries an identical `deploy.yml` and a values file with smaller resources.

Merge these files to `main`. That first PR gets no preview, because the repo only counts once the values file is on the default branch.

## Check it end to end

The worked example is hello-k3s. Replace it with your repo. Go down the list; the first item that fails is where to look in *Troubleshooting*.

```end-to-end checklist
APP=hello-k3s; ORG=<your-org>

# 1. The build ran and succeeded
gh run list -R $ORG/$APP --workflow deploy.yml --limit 3

# 2. The image is on GHCR with sha-<7> and latest
gh api orgs/$ORG/packages/container/$APP/versions \
  --jq '.[0:3][] | "\(.created_at) \(.metadata.container.tags)"'

# 3. The Application exists, Synced and Healthy (up to 3 minutes after merge)
kubectl get application $APP -n argocd

# 4. Image Updater set the tag (up to 2 minutes after the build)
kubectl get application $APP -n argocd -o jsonpath='{.spec.sources[0].helm.parameters}{"\n"}'

# 5. The pod runs and the certificate is ready
kubectl get pods,certificate -n $APP
curl -sI https://hello.<your-domain> | head -1      # HTTP/2 200

# 6. A preview: open a PR from a branch, wait for the bot comment, then
kubectl get applications -n argocd -l app-platform-preview=true
curl -sI https://$APP-pr-<number>.<your-domain> | head -1
```

Then close the PR and watch `kubectl get ns` lose `hello-k3s-pr-<number>` within a couple of minutes. For us, the whole loop from merge to `https://hello.mansus.org` serving the new page is the build time plus about two minutes.

## Why it's built this way

Several settings look wrong at first sight and are load-bearing. Read this before "fixing" one.

**Two tag families that can't cross.** Production only takes tags matching `^sha-[0-9a-f]{7,40}$`. Previews only ever push `pr-*`. A pull request can't reach production by accident, and the rule is enforced on both sides.

**Write-back `argocd`, not git.** Image Updater can commit each new tag to git. We let it edit the Application in the cluster instead: no bot needs write access to any repo, and there are no "bump tag" commits. The cost: git doesn't say which build runs, and a manual rollback in the Argo CD UI doesn't stick, because Image Updater moves it back within 2 minutes. To roll back, re-run the last good build in Actions; it becomes the newest `sha-*`. Then revert in git.

**`ignoreApplicationDifferences`, and the chart stays source 0.** The ApplicationSet controller rewrites its Applications to match the template on every pass. Image Updater writes the tag onto the same object. Without the ignore rule, they fight and the app flips between `latest` and its tag. The ignored path says `sources/0`, and Image Updater writes to the first source with a `helm:` block, so swapping the two sources breaks both.

**`latest` as the default tag.** A brand-new app works before Image Updater has ever seen it. If an Application is recreated, it starts on `latest` and gets its `sha-*` tag back within 2 minutes. `latest` is the same build, so nothing visible changes. Editing the template's `sources` list causes the same harmless reset once.

**Disks are never deleted automatically.** Production PVCs carry `helm.sh/resource-policy: keep` and `Prune=false,Delete=false`. Removing an app or turning off `persistence` leaves the data. Deleting the namespace by hand is the one destructive step, so a person takes it.

**Previews own their namespace.** Argo CD never deletes a namespace it made with `CreateNamespace=true`; that protects production. For previews it would leave an empty namespace per PR. So in preview mode the chart renders the Namespace, which the finalizer deletes like everything else.

**Forks are never built.** The `preview` job only runs for branches of the repo itself. The runners live inside your cluster and code from strangers should not run there. A fork's PR still gets an Application, which waits in `ImagePullBackOff` until the PR closes. This is also what makes allowing public repos on the runner group safe.

**Repo name becomes the namespace.** One name everywhere makes every command predictable: Application, namespace, Deployment, Service and image are all `<repo>`. Hence the naming rule. A repo called `hello.example.com` can't deploy; call it `hello-k3s` and set the host in values.

**One `ImageUpdater` for all apps.** The ApplicationSet template writes the label and the annotations, so onboarding a repo never touches Image Updater.

**Runners in the cluster, not GitHub-hosted.** Builds use your node's CPU and memory, and a busy build competes with apps. In return private repos build without paying for minutes, images push from next to where they run, and the runner pool is one more file in `apps/`. If your server is small, switch `runs-on` to `ubuntu-latest`; nothing else in the chain changes.

**HTTP-01, not a wildcard certificate.** A wildcard certificate needs DNS-01, which means giving the cluster credentials for your DNS provider. HTTP-01 needs none. The price: one certificate per host, and each counts against Let's Encrypt's limits.

## Troubleshooting

Set `APP=<repo>` first. For a preview, use `APP=<repo>-pr-<number>` in the pod commands.

**The ApplicationSet shows `403` or `Resource not accessible by personal access token`.** Token A lacks a permission. The org scan needs Contents and Metadata; the preview generator also needs Pull requests: Read-only. Edit the token on GitHub and add it; the value doesn't change, so nothing to re-seal. If your org requires approval, the edit stays pending until an owner approves it. `401 Bad credentials` means the token expired: create a new one and re-run its seal command.

**No Application for a repo, no error.** `.k3s/values.yaml` isn't on the default branch, the repo is outside the org, or the name has `.` or `_`. To skip the 3-minute wait: `kubectl annotate applicationset org-apps -n argocd argocd.argoproj.io/application-set-refresh=true --overwrite`.

**`ImagePullBackOff`.** Right after a merge, the build simply isn't finished. If it lasts, check the pull secret: `kubectl get secret -n $APP ghcr-pull`. Missing means the SealedSecret didn't decrypt (`kubectl describe sealedsecret -n $APP ghcr-pull`), almost always because it was sealed without `--scope cluster-wide`. Present but rejected means Token B expired or lost `read:packages`.

**Certificate stuck at `READY False`.** DNS doesn't point at the server yet, so Let's Encrypt can't fetch the challenge. `dig +short <host>`, then `kubectl get challenges -n $APP`. Fix DNS; cert-manager retries on its own.

**The tag flips back and forth, or the app keeps returning to `latest`.** Two writers on the same field: `ignoreApplicationDifferences` is missing from the ApplicationSet, or the chart is no longer source 0.

**A preview fails with `CreateContainerConfigError`.** The app's secrets are sealed for namespace `<repo>` and can't be decrypted in `<repo>-pr-<number>`. Either accept broken previews for that app, or seal separate *test* credentials with `--scope cluster-wide` and list them under `preview.sealedSecrets` with `scope: cluster-wide` and the same secret name. Never do this with production credentials: anyone who can create resources on the cluster can decrypt a cluster-wide secret.

**Let's Encrypt rate limits.** Every preview gets its own certificate, and Let's Encrypt allows 50 new certificates per registered domain per week. Normal PR traffic is far below that; scripts opening hundreds of PRs aren't. While testing the platform itself, set `ingress.clusterIssuer: letsencrypt-staging`.

**Jobs stuck in *Queued*.** All 3 runners are busy, the node is out of memory (the runner pod is `Pending`), or the repo is public and the runner group doesn't allow public repos. `kubectl get pods -n arc-runners` and the listener's logs in `arc-systems` tell which.

**Pod `Running` but never ready.** Wrong `port` or `healthCheck.path`: the app must answer 200 on that path.

## Limits and next steps

What you have is small and works. It is also fragile in ways that matter as more apps move onto it.

- **One node.** Every app, the runners and Argo CD run on one machine. If it goes down, everything does. A second node also needs storage both nodes can see, since `local-path` disks are folders on one node.
- **Backups.** Disks are never deleted, which is not the same as backed up. Back up PVCs and the Sealed Secrets key, and test by restoring.
- **Image cleanup.** Neither `sha-*` nor `pr-*` images are deleted on GHCR. Closed PRs leave images behind.
- **Secrets in previews.** Cluster-wide sealing works but is broad. A per-preview mechanism would be better.
- **Alerting.** A failed sync, an expired token or a stuck certificate shows up in Argo CD and in logs, but nothing tells anyone. Argo CD Notifications is the obvious place to start.
