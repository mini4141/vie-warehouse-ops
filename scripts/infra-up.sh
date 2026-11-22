#!/usr/bin/env bash
# ECR first (ECS needs an image to exist), push the image, then the full apply.
source "$(dirname "$0")/common.sh"
assert_account
mkdir -p "$EVIDENCE"

cd "$TF_DIR"
terraform init -input=false
echo "apply_start=$(date -u +%FT%TZ)" > "$EVIDENCE/stack-timestamps.txt"

# The budget is a dependency of ECR, so the USD 10 budget is created before anything else.
terraform apply -input=false -auto-approve -target=aws_ecr_repository.api

bash "$ROOT/scripts/deploy.sh" image

terraform plan -input=false -out=tfplan
terraform apply -input=false tfplan 2>&1 | tee "$EVIDENCE/terraform-apply.txt"
rm -f tfplan
echo "apply_end=$(date -u +%FT%TZ)" >> "$EVIDENCE/stack-timestamps.txt"
terraform output -json > "$EVIDENCE/terraform-outputs.json"
