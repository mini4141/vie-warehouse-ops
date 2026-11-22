#!/usr/bin/env bash
# Collects trimmed CLI evidence while the stack is up. Nothing secret is written (no passwords, no connection strings).
export MSYS_NO_PATHCONV=1
source "$(dirname "$0")/common.sh"
assert_account
mkdir -p "$EVIDENCE"
CLUSTER="$(tf_out ecs_cluster)"
SERVICE="$(tf_out ecs_service)"
DIST="$(tf_out cloudfront_distribution_id)"

aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" \
  --query 'services[0].{name:serviceName,status:status,desired:desiredCount,running:runningCount,launchType:launchType,taskDefinition:taskDefinition,deployments:deployments[].{status:status,rollout:rolloutState,running:runningCount}}' \
  > "$EVIDENCE/ecs-service.json"

aws rds describe-db-instances --db-instance-identifier woc-db \
  --query 'DBInstances[0].{id:DBInstanceIdentifier,status:DBInstanceStatus,class:DBInstanceClass,engine:Engine,version:EngineVersion,storageGb:AllocatedStorage,storageType:StorageType,multiAz:MultiAZ,publiclyAccessible:PubliclyAccessible,endpointHost:Endpoint.Address}' \
  > "$EVIDENCE/rds-instance.json"

if [ -n "$DIST" ]; then
  aws cloudfront get-distribution --id "$DIST"     --query 'Distribution.{id:Id,domain:DomainName,status:Status}' > "$EVIDENCE/cloudfront-distribution.json"
else
  aws elbv2 describe-load-balancers --names woc-alb     --query 'LoadBalancers[0].{name:LoadBalancerName,dns:DNSName,state:State.Code,scheme:Scheme,type:Type}'     > "$EVIDENCE/alb.json"
fi

aws logs filter-log-events --log-group-name /ecs/woc-api --filter-pattern '"ROBOT_FAULT"' \
  --query 'events[].message' --output text | tail -n 100 > "$EVIDENCE/cloudwatch-logs.txt"
# Surrounding context lines (server start, other events) so the file shows the service is healthy too.
aws logs tail /ecs/woc-api --since 30m --format short | tail -n 100 >> "$EVIDENCE/cloudwatch-logs.txt"
echo "evidence written to $EVIDENCE"
