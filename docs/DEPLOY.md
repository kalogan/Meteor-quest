# Deploying Meteor Quest to Vercel

The whole thing is a **backend-free static bundle** (the sim runs in the browser,
state persists to localStorage — no server, no env vars, no secrets). It deploys as a
**single Vercel project** via Git integration (connect once → auto-builds every push,
plus a preview deployment for every branch/PR):

| Path | What | Entry |
|---|---|---|
| `/` | the playable game | `index.html` |
| `/preview` | the preview / content editor | `preview.html` |

The product Vite build is **multi-page** (`vite.config.ts` emits both `index.html` and
`preview.html` into one `dist/`, sharing chunks), and the repo's root `vercel.json`
sets `cleanUrls: true` so `preview.html` is served at **`/preview`**. So one project,
one deploy, both pages. No build settings to type — Vercel reads `./vercel.json`:

```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @meteor/client build",
  "outputDirectory": "packages/client/dist",
  "cleanUrls": true
}
```

The repo is CI-ready: `packageManager: pnpm@10.33.0` (corepack), `engines.node ">=22"`,
`pnpm.onlyBuiltDependencies: ["esbuild"]`, committed `pnpm-lock.yaml`.

---

## One-time setup (you, in the Vercel dashboard)
Needs your Vercel account — can't be done from the repo or the build agent.

1. Vercel → **Add New… → Project** → import **`kalogan/meteor-quest`**.
2. Leave **Root Directory** at the repo root (it reads `./vercel.json` — install/build/
   output/cleanUrls are all set). **Framework Preset:** `Other`.
3. **Settings → Node.js Version → 22.x**.
4. **Settings → Git → Production Branch** → set to the branch you want live
   (`claude/workflow-docs-review-x2qjqt`, or merge to `main`).
5. **Deploy.**

That's it — every push to the production branch auto-deploys; the game is at `/`, the
preview editor at `/preview`. (If you previously created a *second* Vercel project for
the preview, delete it — it's no longer needed.)

## Verifying
- `https://<your-app>.vercel.app/` → the game (boots to the cradle; reload → resumes
  from autosave).
- `https://<your-app>.vercel.app/preview` → the preview harness (World / Biomes / Tech).

Reproduce the build locally:
```bash
pnpm install --frozen-lockfile
pnpm --filter @meteor/client build      # → packages/client/dist (index.html + preview.html)
pnpm dev                                 # then visit / and /preview (dev clean-URL middleware)
```

## Notes
- **`/preview` locally:** `vite.config.ts` adds a dev-only middleware that rewrites
  `/preview` → `/preview.html`, mirroring Vercel's `cleanUrls`, so `pnpm dev` matches prod.
- **No SPA rewrites needed** — neither page has client-side routing.
- **Optional standalone preview:** `vite.preview.config.ts` + `pnpm --filter @meteor/client
  build:preview` still emit the harness as its own `dist-preview/index.html` for separate
  static hosting (per PREVIEW_HARNESS.md). Not used by the single-project deploy above.
- The ~1.2 MB three.js bundle is a Vite chunk-size *warning*, not an error.

## Alternative: GitHub Actions + Vercel token
If you ever want deploys codified in-repo instead of the dashboard, I can add a workflow
using `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` secrets — more setup than
the Git integration above, so only if you specifically want it.
