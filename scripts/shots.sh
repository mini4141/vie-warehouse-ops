#!/usr/bin/env bash
# Screenshot run against BASE_URL, or the CloudFront URL from terraform when the stack is up.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -z "${BASE_URL:-}" ]; then
  export AWS_PROFILE=warehouse AWS_PAGER=""
  BASE_URL="$(cd "$ROOT/infra/terraform" && terraform output -raw app_url)"
fi
export BASE_URL
pnpm --dir "$ROOT/apps/web" exec playwright test -c playwright.shots.config.ts
