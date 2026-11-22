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

BUCKET="$(tf_out web_bucket)"
DIST="$(tf_out cloudfront_distribution_id)"
URL="$(tf_out cloudfront_url)"
CLUSTER="$(tf_out ecs_cluster)"
SERVICE="$(tf_out ecs_service)"

VITE_DATA_SOURCE=live VITE_APP_VERSION="$VERSION" pnpm --dir "$ROOT/apps/web" build
push_image
aws s3 sync "$ROOT/apps/web/dist" "s3://$BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" >/dev/null
aws ecs update-service --cluster "$CLUSTER" --service "$SERVICE" --force-new-deployment >/dev/null
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

echo "smoke: $URL"
curl -fsS "$URL/healthz" && echo
curl -fsS "$URL/api/dashboard/summary" | head -c 200 && echo
echo "deployed $VERSION"
