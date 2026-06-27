# Deploying Meteor Quest to Vercel

Both deployables are **fully client-side static bundles** (the sim runs in the browser,
state persists to localStorage — there is no backend), so they host on Vercel as plain
static sites with **no environment variables and no secrets**.

We run **two Vercel projects from this one repo**, both via **Vercel's Git integration**
(connect once in the dashboard → auto-builds every push, and a preview deployment for
every branch/PR):

| Project | What | Build command | Output directory |
|---|---|---|---|
| **Game** | the playable client | `pnpm --filter @meteor/client build` | `packages/client/dist` |
| **Preview harness** | content/component inspector | `pnpm --filter @meteor/client build:preview` | `packages/client/dist-preview` |

> Two projects can't share one repo `vercel.json` with different build commands, so the
> per-project build config lives in each project's **dashboard settings** (below) — not
> in the repo. The repo itself needs no Vercel config file.

The repo is already set up for these builds: `packageManager: pnpm@10.33.0` (Vercel
picks pnpm via corepack), `engines.node: ">=22"`, `pnpm.onlyBuiltDependencies: ["esbuild"]`
(so esbuild's native binary builds in CI), and a committed `pnpm-lock.yaml`.

---

## One-time setup (you, in the Vercel dashboard)

This is the part that needs your Vercel account — it can't be done from the repo.

### Project A — the Game

1. Vercel → **Add New… → Project** → import the GitHub repo **`kalogan/meteor-quest`**.
2. **Framework Preset:** `Other`.
3. **Root Directory:** leave as the repo root (`./`).
4. Expand **Build & Output Settings** and set (toggle the "Override" switches):
   - **Install Command:** `pnpm install --frozen-lockfile`
   - **Build Command:** `pnpm --filter @meteor/client build`
   - **Output Directory:** `packages/client/dist`
5. **Settings → General → Node.js Version:** `22.x`.
6. **Deploy.** Note the URL (e.g. `meteor-quest.vercel.app`).

### Project B — the Preview Harness

Repeat **Add New… → Project** and import the **same** repo again (Vercel allows multiple
projects per repo — it'll note it's already connected, which is fine). Name it e.g.
`meteor-quest-preview`. Identical settings **except**:

   - **Build Command:** `pnpm --filter @meteor/client build:preview`
   - **Output Directory:** `packages/client/dist-preview`

### Production branch

Vercel deploys your **Production Branch** to the production URL and every other branch as
a **preview**. In each project: **Settings → Git → Production Branch** → set it to the
branch you want live. Today the work is on `claude/workflow-docs-review-x2qjqt`; either
point Production Branch at it, or merge to `main` and use that. Every push to that branch
then auto-deploys; every other branch/PR gets its own preview URL automatically.

---

## Verifying it works

- After the first deploy, open the Game URL — it should boot to the cradle planet and
  start ticking (this is the same static bundle verified locally via
  `pnpm --filter @meteor/client build`).
- Open the Preview URL — the harness with World / Biomes / Tech modes.
- Reload the Game tab — it should **resume** (localStorage autosave), proving persistence
  works in production too.

You can reproduce Vercel's build locally at any time:

```bash
pnpm install --frozen-lockfile
pnpm --filter @meteor/client build           # → packages/client/dist
pnpm --filter @meteor/client build:preview    # → packages/client/dist-preview
```

---

## Notes & troubleshooting

- **No SPA rewrites needed** — both apps are a single `index.html` with no client-side
  routing, so Vercel serves them at `/` with no rewrite rules. (If routing is added
  later, add a `vercel.json` rewrite `{"source":"/(.*)","destination":"/index.html"}`
  to the affected project's Root Directory.)
- **pnpm version** comes from `packageManager` in the root `package.json`; bump it there
  if you upgrade pnpm.
- **esbuild "you installed esbuild on another platform"** would mean the build-script
  allowlist didn't apply — it's set via `pnpm.onlyBuiltDependencies` in the root
  `package.json`; keep `esbuild` listed there.
- **Frozen-install failures** mean `pnpm-lock.yaml` drifted from `package.json` — run
  `pnpm install` locally and commit the updated lockfile.
- The ~1.1 MB JS bundle (three.js) triggers a Vite chunk-size *warning*, not an error;
  it's fine. Code-splitting is a later optimization if load time matters.

## Alternative: GitHub Actions + Vercel token

If you later want deploy logic in-repo instead of the dashboard, swap to a GitHub Actions
workflow that runs `vercel deploy --prod` using `VERCEL_TOKEN` / `VERCEL_ORG_ID` /
`VERCEL_PROJECT_ID` repo secrets (one project id per app). Say the word and I'll add the
workflow — it needs you to create the token and add the three secrets.
