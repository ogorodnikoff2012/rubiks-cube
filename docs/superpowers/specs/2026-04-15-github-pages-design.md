# GitHub Pages Deployment — Design

**Date:** 2026-04-15
**Status:** Approved

## Goal

Publish the Rubik's Cube app to GitHub Pages at `https://ogorodnikoff2012.github.io/rubiks-cube/`, with automated CI on every push and pull request, and branch protection on `master`.

## Vite Config Change

GitHub Pages serves the app from a subdirectory (`/rubiks-cube/`), not the domain root. Vite must be told the base path so all asset URLs in the built HTML are prefixed correctly.

Change in `vite.config.ts`:

```ts
base: '/rubiks-cube/',
```

Without this, `dist/index.html` references `/assets/...` which 404s on Pages.

## GitHub Actions Workflow

Single file: `.github/workflows/ci.yml`

### Triggers

- `push` to `master`
- `pull_request` targeting `master`

### Jobs

#### `ci` (runs on both triggers)

1. Checkout code
2. Set up Node.js with Yarn cache
3. `yarn install --frozen-lockfile`
4. `yarn lint` — ESLint
5. `yarn format:check` — Prettier
6. `yarn build` — `tsc -b` (type-check) + Vite bundle

#### `deploy` (runs only on `push` to `master`, `needs: ci`)

Permissions required: `pages: write`, `id-token: write` (OIDC for GitHub Pages).

1. Checkout code
2. Set up Node.js with Yarn cache
3. `yarn install --frozen-lockfile`
4. `yarn build`
5. `actions/configure-pages`
6. `actions/upload-pages-artifact` — uploads `dist/`
7. `actions/deploy-pages`

The deploy job re-runs the build because the Pages artifact must be produced within the deploy job itself. The `needs: ci` dependency ensures deploy never runs if CI fails.

### Environment

The `deploy` job runs in the `github-pages` environment, which is required by the official Pages deploy action.

## Branch Protection (master)

Configured via the GitHub API:

- **Require pull request before merging** — no direct pushes to `master`
- **Required status checks:** `ci` (the job name from `ci.yml`)
- **Require branches to be up to date before merging** — CI must pass against the latest `master`, not a stale base

## GitHub Pages Configuration

In the repository settings, Pages source must be set to **"GitHub Actions"** (not a branch). This is what allows `actions/deploy-pages` to publish directly via OIDC without a `gh-pages` branch.

## Files Changed

| File                       | Change                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| `vite.config.ts`           | Add `base: '/rubiks-cube/'`                                        |
| `.github/workflows/ci.yml` | Create — CI + deploy workflow                                      |
| GitHub repo settings       | Enable Pages (source: GitHub Actions), configure branch protection |
