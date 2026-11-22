#!/usr/bin/env bash
# Release: build web + api image, push, sync S3, invalidate CloudFront, roll ECS, smoke test.
# `deploy.sh image` only builds and pushes the API image (used by infra-up before the full apply).
source "$(dirname "$0")/common.sh"
assert_account

VERSION="$(git -C "$ROOT" describe --tags --always)"
ECR="$(tf_out ecr_repo_url)"

push_image() {
  aws ecr get-login-password | docker login --username AWS --password-stdin "${ECR%%/*}" >/dev/null
  docker buildx build --platform linux/amd64 -t "$ECR:$VERSION" -t "$ECR:latest" --push "$ROOT/apps/api"
  docker logout "${ECR%%/*}" >/dev/null
}

if [ "${1:-}" = "image" ]; then
  push_image
  exit 0
fi

URL="$(tf_out app_url)"
CLUSTER="$(tf_out ecs_cluster)"
SERVICE="$(tf_out ecs_service)"

# ALB-only deployment (CloudFront needs an AWS-verified account): the API image also serves the SPA build.
VITE_DATA_SOURCE=live VITE_APP_VERSION="$VERSION" pnpm --dir "$ROOT/apps/web" build
rm -rf "$ROOT/apps/api/static" && cp -r "$ROOT/apps/web/dist" "$ROOT/apps/api/static"
push_image
if [ -n "$(tf_out cloudfront_distribution_id)" ]; then
  aws cloudfront create-invalidation --distribution-id "$(tf_out cloudfront_distribution_id)" --paths "/*" >/dev/null
fi
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment >/dev/null
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

echo "smoke: $URL"
curl -fsS "$URL/healthz" && echo
curl -fsS "$URL/api/dashboard/summary" | head -c 200 && echo
echo "deployed $VERSION"
