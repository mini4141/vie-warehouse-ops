#!/usr/bin/env bash
# Reports anything belonging to this project that still exists. Exit 1 if anything is found.
export MSYS_NO_PATHCONV=1
source "$(dirname "$0")/common.sh"
set +e
assert_account
FOUND=0

check() { # name, output-of-query
  local name="$1" out="$2"
  out="$(echo "$out" | sed '/^None$/d;/^$/d')"
  if [ -n "$out" ]; then
    echo "FOUND   $name: $out"
    FOUND=1
  else
    echo "ok      $name: none"
  fi
}

echo "verify-destroyed $(date -u +%FT%TZ) account=$EXPECTED_ACCOUNT region=$AWS_REGION"

# Tag-based sweep. CloudFront and other global resources are indexed in us-east-1.
for region in ap-southeast-2 us-east-1; do
  check "tagged project=woc ($region)" "$(aws resourcegroupstaggingapi get-resources --region $region \
    --tag-filters Key=project,Values=woc --query 'ResourceTagMappingList[].ResourceARN' --output text | tr '\t' '\n')"
done

check "cloudfront distributions" "$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='woc'].Id" --output text)"
check "load balancers" "$(aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?starts_with(LoadBalancerName,'woc')].LoadBalancerArn" --output text 2>/dev/null)"
check "target groups" "$(aws elbv2 describe-target-groups \
  --query "TargetGroups[?starts_with(TargetGroupName,'woc')].TargetGroupArn" --output text 2>/dev/null)"
check "rds instances" "$(aws rds describe-db-instances \
  --query "DBInstances[?starts_with(DBInstanceIdentifier,'woc')].DBInstanceIdentifier" --output text)"
check "rds snapshots" "$(aws rds describe-db-snapshots \
  --query "DBSnapshots[?starts_with(DBInstanceIdentifier,'woc')].DBSnapshotIdentifier" --output text)"
check "ecs clusters" "$(aws ecs list-clusters --query "clusterArns[?contains(@, '/woc')]" --output text)"
check "nat gateways" "$(aws ec2 describe-nat-gateways --filter Name=tag:project,Values=woc Name=state,Values=pending,available,deleting \
  --query 'NatGateways[].NatGatewayId' --output text)"
check "elastic ips" "$(aws ec2 describe-addresses --filters Name=tag:project,Values=woc --query 'Addresses[].AllocationId' --output text)"
check "vpcs" "$(aws ec2 describe-vpcs --filters Name=tag:project,Values=woc --query 'Vpcs[].VpcId' --output text)"
check "ecr repositories" "$(aws ecr describe-repositories \
  --query "repositories[?repositoryName=='woc-api'].repositoryName" --output text 2>/dev/null)"
check "s3 buckets" "$(aws s3api list-buckets --query "Buckets[?starts_with(Name,'woc-')].Name" --output text)"
check "ssm parameters" "$(aws ssm describe-parameters --parameter-filters Key=Name,Option=BeginsWith,Values=/woc/ \
  --query 'Parameters[].Name' --output text)"
check "log groups" "$(aws logs describe-log-groups --log-group-name-prefix /ecs/woc \
  --query 'logGroups[].logGroupName' --output text)"
check "iam roles woc-*" "$(aws iam list-roles --query "Roles[?starts_with(RoleName,'woc-')].RoleName" --output text)"
check "budgets" "$(aws budgets describe-budgets --account-id $EXPECTED_ACCOUNT \
  --query "Budgets[?BudgetName=='woc-monthly'].BudgetName" --output text 2>/dev/null)"

if [ "$FOUND" -eq 0 ]; then
  echo "RESULT: zero woc resources found"
else
  echo "RESULT: resources remain (CloudFront can take 5-15 minutes; re-run)"
fi
exit $FOUND
