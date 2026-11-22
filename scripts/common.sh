#!/usr/bin/env bash
# Shared guardrails: fixed profile/region and a hard account lock before anything touches AWS.
set -euo pipefail

export AWS_PROFILE=warehouse
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2
export AWS_PAGER=""

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$ROOT/infra/terraform"
EVIDENCE="$ROOT/docs/evidence"
EXPECTED_ACCOUNT=727965304944

assert_account() {
  local acct
  acct="$(aws sts get-caller-identity --query Account --output text)"
  if [ "$acct" != "$EXPECTED_ACCOUNT" ]; then
    echo "Refusing to run: AWS account is $acct, expected $EXPECTED_ACCOUNT" >&2
    exit 1
  fi
}

tf_out() { (cd "$TF_DIR" && terraform output -raw "$1"); }
