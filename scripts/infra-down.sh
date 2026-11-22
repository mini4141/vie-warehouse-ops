#!/usr/bin/env bash
# terraform destroy + verification. Prompts unless WOC_CONFIRM_DESTROY=yes (autonomous runs set it).
source "$(dirname "$0")/common.sh"
assert_account

if [ "${WOC_CONFIRM_DESTROY:-}" != "yes" ]; then
  read -r -p "Destroy ALL woc resources in account $EXPECTED_ACCOUNT? [y/N] " answer
  [ "$answer" = "y" ] || exit 1
fi

mkdir -p "$EVIDENCE"
cd "$TF_DIR"
echo "destroy_start=$(date -u +%FT%TZ)" >> "$EVIDENCE/stack-timestamps.txt"
terraform destroy -input=false -auto-approve 2>&1 | tee "$EVIDENCE/terraform-destroy.txt"
echo "destroy_end=$(date -u +%FT%TZ)" >> "$EVIDENCE/stack-timestamps.txt"

bash "$ROOT/scripts/verify-destroyed.sh" 2>&1 | tee "$EVIDENCE/destroy-verified.txt"
