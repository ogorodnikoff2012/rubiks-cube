# GitHub Pages Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the app to `https://ogorodnikoff2012.github.io/rubiks-cube/` with automated CI on every push/PR and protected `master` branch.

**Architecture:** Single GitHub Actions workflow with a `ci` job (lint + format-check + build) and a `deploy` job (build + Pages publish) gated on `ci`. Branch protection requires the `ci` job to pass and a PR to be opened before merging to `master`.

**Tech Stack:** Vite 6, GitHub Actions, GitHub Pages (Actions source / OIDC), `gh` CLI for repo setup.

---

### Task 1: Add Vite base path

**Files:**

- Modify: `vite.config.ts`

GitHub Pages serves the app at `/rubiks-cube/` (subdirectory), not `/`. Without `base`, Vite emits asset paths like `/assets/index-abc.js` which 404 on Pages.

- [ ] **Step 1: Edit `vite.config.ts`**

Replace the entire file content with:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/rubiks-cube/',
  plugins: [react()],
});
```

- [ ] **Step 2: Verify the build uses the base path**

```bash
yarn build
grep 'rubiks-cube' dist/index.html
```

Expected: lines like `src="/rubiks-cube/assets/index-....js"` and `href="/rubiks-cube/assets/index-....css"`.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: set vite base path for github pages"
```

---

### Task 2: Create GitHub Actions workflow

**Files:**

- Create: `.github/workflows/ci.yml`

The `ci` job name (matching the YAML job key) becomes the status check context `"CI / ci"` in GitHub (workflow name + job id). Branch protection in Task 4 will reference this exact string.

The `deploy` job re-runs `yarn build` because the Pages artifact must be produced within the same job that calls `actions/upload-pages-artifact`.

- [ ] **Step 1: Create the workflow directory and file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/ci.yml` with this exact content:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn lint
      - run: yarn format:check
      - run: yarn build

  deploy:
    needs: ci
    if: github.ref == 'refs/heads/master' && github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Verify the YAML is valid**

```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add github actions workflow for ci and pages deploy"
```

---

### Task 3: Push to GitHub and enable Pages

**Files:**

- GitHub repo settings (via `gh` CLI)

Pages source must be set to "GitHub Actions" before the deploy job can publish. Without this, `actions/deploy-pages` will fail with a 404 or permissions error.

- [ ] **Step 1: Push the branch**

```bash
git push origin master
```

Expected: two commits pushed (`feat: set vite base path...` and `ci: add github actions workflow...`).

- [ ] **Step 2: Enable GitHub Pages with Actions source**

```bash
gh api repos/ogorodnikoff2012/rubiks-cube/pages \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  --field build_type=workflow
```

Expected: JSON response with `"build_type": "workflow"`.

If Pages is already enabled (HTTP 409), update instead:

```bash
gh api repos/ogorodnikoff2012/rubiks-cube/pages \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  --field build_type=workflow
```

- [ ] **Step 3: Verify Pages is configured**

```bash
gh api repos/ogorodnikoff2012/rubiks-cube/pages \
  -H "Accept: application/vnd.github+json" \
  --jq '.build_type'
```

Expected: `"workflow"`

- [ ] **Step 4: Wait for the first CI run to complete and deploy**

```bash
gh run watch --repo ogorodnikoff2012/rubiks-cube
```

Select the most recent run. Expected: both `ci` and `deploy` jobs show green.

- [ ] **Step 5: Verify the live URL**

```bash
curl -sI https://ogorodnikoff2012.github.io/rubiks-cube/ | head -5
```

Expected: `HTTP/2 200` (or `301`/`302` redirect to the same URL).

---

### Task 4: Configure branch protection

**Files:**

- GitHub repo settings (via `gh` CLI)

The status check context name is `"CI / ci"` — the GitHub Actions workflow name (`CI`) concatenated with the job id (`ci`) via `/`. This must match exactly or the required check won't be recognized.

`required_pull_request_reviews` with `required_approving_review_count: 0` enables the "require a pull request before merging" rule without demanding reviews from other users — appropriate for a solo repo.

- [ ] **Step 1: Apply branch protection**

```bash
gh api repos/ogorodnikoff2012/rubiks-cube/branches/master/protection \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI / ci"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null
}
EOF
```

Expected: JSON response showing `"required_status_checks"` and `"required_pull_request_reviews"` non-null.

- [ ] **Step 2: Verify protection is active**

```bash
gh api repos/ogorodnikoff2012/rubiks-cube/branches/master/protection \
  -H "Accept: application/vnd.github+json" \
  --jq '{status_checks: .required_status_checks.contexts, strict: .required_status_checks.strict, pr_required: (.required_pull_request_reviews != null)}'
```

Expected:

```json
{
  "status_checks": ["CI / ci"],
  "strict": true,
  "pr_required": true
}
```

- [ ] **Step 3: Smoke-test protection by attempting a direct push**

Create a trivial change and try to push directly to master:

```bash
git commit --allow-empty -m "test: verify branch protection blocks direct push"
git push origin master
```

Expected: push is **rejected** with a message like `remote: error: GH006: Protected branch update failed`.

- [ ] **Step 4: Clean up the test commit**

```bash
git reset HEAD~1
```
