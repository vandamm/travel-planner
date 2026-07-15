# Pull Request Preview Environments

## Goal

Deploy each same-repository pull request to a public, disposable Cloudflare Worker that serves the SPA and API with the staging Liveblocks project. Delete the Worker when the pull request closes.

## Architecture

Each pull request owns one Worker named `travel-planner-pr-<number>`. Cloudflare Worker Static Assets serves the Vite build, and the existing Worker handles `/api/*` and `/mcp`. The deployment uses the existing staging KV namespace and a fixed `DEV_AUTH_EMAIL` identity because previews are public.

This differs from production only at the hosting boundary: production keeps Pages and the production Worker separate; previews combine them so one `wrangler delete` removes the whole environment. A Pages branch preview cannot meet the cleanup requirement because Cloudflare does not allow deletion of a branch's latest deployment.

## Files

- `.github/workflows/deploy-preview.yml` manages deployment and cleanup.
- `worker/wrangler.preview.toml` defines staging bindings and Static Assets routing.

## Lifecycle

The workflow listens for `pull_request` events: `opened`, `synchronize`, `reopened`, and `closed`.

- Opened, synchronized, or reopened: install dependencies, run tests, build with `VITE_WORKER_URL` unset, and deploy `travel-planner-pr-<number>`.
- Closed, including merged: delete `travel-planner-pr-<number>` with `wrangler delete --force`.
- A per-PR concurrency group cancels an obsolete deployment when a new commit or close event arrives.
- Fork pull requests do not deploy because GitHub withholds repository secrets from fork workflows.

The workflow writes the stable preview URL to the GitHub Actions job summary.

## Configuration and Secrets

The preview Wrangler configuration:

- enables `workers.dev`;
- binds the existing staging `SNAPSHOTS` KV namespace;
- serves `../dist` with SPA fallback;
- runs the Worker first for `/api/*` and `/mcp`;
- sets `DEV_AUTH_EMAIL` to `preview@travel-planner.invalid`.

GitHub must provide `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `LIVEBLOCKS_STAGING_SECRET_KEY`. The workflow passes the Liveblocks key to Wrangler through an ephemeral secrets file and never writes it to the repository or logs.

## Failure Handling

Tests or build failures stop deployment. Wrangler uploads each replacement atomically, so the previous preview remains available if an update fails. Cleanup failures remain visible in GitHub Actions instead of being ignored.

## Verification

Local verification checks workflow formatting, Wrangler configuration, unit tests, and the production Vite build. The first same-repository pull request verifies remote deployment, the preview URL, staging Liveblocks access, SPA routing, API routing, and cleanup after closure.
