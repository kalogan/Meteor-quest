# Deploying Meteor Quest to Vercel

Both deployables are **fully client-side static bundles** (the sim runs in the browser,
state persists to localStorage — there is no backend), so they host on Vercel as plain
static sites with **no environment variables and no secrets**.

We run **two Vercel projects from this one repo**, both via **Vercel's Git integration**
(connect once → auto-builds every push, plus a preview deployment for every branch/PR):

| Project | What | Reads config from | Output |
|---|---|---|---|
| **Game** | the playable client | `./vercel.json` | `packages/client/dist` |
| **Preview harness** | content/component inspector | `./packages/client/vercel.json` | `packages/client/dist-preview` |

The builds are **pre-configured in the repo** via two `vercel.json` files, so you type
**no build settings** in the dashboard. Vercel reads `vercel.json` from each project's
**Root Directory**, which is how two projects in one repo get different builds:

- Game project → Root Directory = repo root (default) → reads `./vercel.json`.
- Preview project → Root Directory = `packages/client` → reads `./packages/client/vercel.json`.

The repo is already CI-ready: `packageManager: pnpm@10.33.0` (Vercel picks pnpm via
corepack), `engines.node: ">=22"`, `pnpm.onlyBuiltDependencies: ["esbuild"]` (esbuild's
native binary builds in CI), and a committed `pnpm-lock.yaml`. A clean
`pnpm install --frozen-lockfile` + both builds were verified locally.

---

## One-time setup (you, in the Vercel dashboard)

This needs your Vercel account — it can't be done from the repo or from the build agent
(the sandbox has no Vercel credentials and can't reach Vercel's API).

### Project A — the Game  (≈1 click)
1. Vercel → **Add New… → Project** → import **`kalogan/meteor-quest`**.
2. Leave **Root Directory** at the repo root. (Vercel reads `./vercel.json` — install,
   build, and output are already set. Framework Preset can stay "Other".)
3. **Settings → Node.js Version → 22.x** (matches `engines.node`).
4. **Deploy.**

### Project B — the Preview harness  (≈2 clicks)
1. **Add New… → Project** → import the **same** repo again (Vercel allows multiple
   projects per repo). Name it e.g. `meteor-quest-preview`.
2. Set **Root Directory** to **`packages/client`** → it reads
   `packages/client/vercel.json` (build:preview → `dist-preview`).
3. **Node.js Version → 22.x**, then **Deploy.**

### Production branch
Vercel deploys your **Production Branch** to the production URL and every other branch as
a preview. In each project: **Settings → Git → Production Branch** → set it to the branch
you want live (today: `claude/workflow-docs-review-x2qjqt`, or merge to `main` and use
that). After that, every push to that branch auto-deploys; every other branch/PR gets its
own preview URL.

---

## Verifying it works
- Game URL → boots to the cradle planet and starts ticking; reload → it **resumes** (the
  localStorage autosave), proving persistence works in production.
- Preview URL → the harness (World / Biomes / Tech modes).

Reproduce Vercel's build locally any time:
```bash
pnpm install --frozen-lockfile
pnpm --filter @meteor/client build           # → packages/client/dist        (game)
pnpm --filter @meteor/client build:preview    # → packages/client/dist-preview (harness)
```

---

## Fallback (if the Root-Directory approach misbehaves)
If the Preview project's Root Directory + `vercel.json` ever fights Vercel's monorepo
detection, configure that project at the repo root instead and override its build in the
dashboard: Root Directory = `./`, **but delete/ignore** `packages/client/vercel.json`'s
effect by setting the project's Build Command = `pnpm --filter @meteor/client build:preview`
and Output Directory = `packages/client/dist-preview` (dashboard overrides only apply when
no `vercel.json` is read at that root).

## Notes & troubleshooting
- **No SPA rewrites needed** — both apps are a single `index.html` with no client-side
  routing. (If routing is added later, add a `vercel.json` rewrite
  `{"source":"/(.*)","destination":"/index.html"}`.)
- **pnpm version** comes from `packageManager` in the root `package.json`.
- **esbuild "installed on another platform"** → ensure `esbuild` stays in
  `pnpm.onlyBuiltDependencies` (root `package.json`).
- **Frozen-install failure** → `pnpm-lock.yaml` drifted; run `pnpm install` and commit it.
- The ~1.1 MB three.js bundle triggers a Vite chunk-size *warning*, not an error.

## Alternative: GitHub Actions + Vercel token
If you later want deploys codified in-repo instead of the dashboard, I can add a workflow
that runs `vercel deploy --prod` for both projects using `VERCEL_TOKEN` /
`VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` (one per app) repo secrets. It's *more* setup than
the dashboard path (a token + 4 secrets you create), so the Git integration above is the
lighter option — but say the word and I'll wire the workflow.
