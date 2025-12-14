#!/bin/bash

# Script to enable API Gateway CloudWatch logging
# Run this after deploying the infrastructure

set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME="bet-tracker"
REGION=${AWS_REGION:-us-east-1}

echo "Enabling API Gateway logging for ${ENVIRONMENT} environment..."

# Get API Gateway ID from main stack
API_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text \
  --region ${REGION})

if [ -z "$API_GATEWAY_ID" ]; then
  echo "Error: Could not find API Gateway ID"
  exit 1
fi

STAGE_NAME=${ENVIRONMENT}
LOG_GROUP_NAME="/aws/apigateway/${PROJECT_NAME}-${ENVIRONMENT}"
ROLE_NAME="${PROJECT_NAME}-${ENVIRONMENT}-apigateway-logs-role"

echo "API Gateway ID: $API_GATEWAY_ID"
echo "Stage: $STAGE_NAME"
echo "Log Group: $LOG_GROUP_NAME"

# Create CloudWatch Log Group if it doesn't exist
echo "Creating CloudWatch Log Group..."
aws logs create-log-group \
  --log-group-name "$LOG_GROUP_NAME" \
  --region ${REGION} 2>/dev/null || echo "Log group already exists"

aws logs put-retention-policy \
  --log-group-name "$LOG_GROUP_NAME" \
  --retention-in-days 14 \
  --region ${REGION}

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create IAM Role for API Gateway logging
echo "Creating IAM Role for API Gateway logging..."
EXISTING_ROLE=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$EXISTING_ROLE" ]; then
  echo "Creating new role..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Principal\": {
          \"Service\": \"apigateway.amazonaws.com\"
        },
        \"Action\": \"sts:AssumeRole\"
      }]
    }"
  
  ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
else
  echo "Role already exists, updating trust policy..."
  ROLE_ARN="$EXISTING_ROLE"
  
  # Update trust policy to ensure it's correct
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Principal\": {
          \"Service\": \"apigateway.amazonaws.com\"
        },
        \"Action\": \"sts:AssumeRole\"
      }]
    }"
fi

echo "Role ARN: $ROLE_ARN"

# Attach inline policy to role with comprehensive CloudWatch Logs permissions
echo "Attaching CloudWatch Logs policy to role..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name CloudWatchLogsPolicy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"logs:CreateLogGroup\",
          \"logs:CreateLogStream\",
          \"logs:PutLogEvents\",
          \"logs:DescribeLogGroups\",
          \"logs:DescribeLogStreams\"
        ],
        \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:*:*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"logs:CreateLogStream\",
          \"logs:PutLogEvents\"
        ],
        \"Resource\": \"arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:*:log-stream:*\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": [
          \"iam:PassRole\"
        ],
        \"Resource\": \"*\"
      }
    ]
  }"

# Wait a moment for IAM changes to propagate
echo "Waiting for IAM changes to propagate..."
sleep 10

# Verify the role exists and has correct permissions
echo "Verifying role configuration..."
aws iam get-role --role-name "$ROLE_NAME" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: Role does not exist after creation!"
  exit 1
fi

# Verify the role policy was attached
aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name CloudWatchLogsPolicy > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: Role policy was not attached correctly!"
  exit 1
fi

echo "Role configuration verified."

# Set API Gateway Account CloudWatch Role (required for execution logging)
echo "Setting API Gateway Account CloudWatch Role..."
echo "Using Role ARN: $ROLE_ARN"
MAX_RETRIES=3
RETRY_COUNT=0
SUCCESS=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Attempt $RETRY_COUNT of $MAX_RETRIES..."
  
  if ERROR_OUTPUT=$(aws apigateway update-account \
    --patch-operations op=replace,path=/cloudwatchRoleArn,value="$ROLE_ARN" \
    --region ${REGION} 2>&1); then
    echo "Successfully configured API Gateway Account CloudWatch Role."
    echo "$ERROR_OUTPUT"
    SUCCESS=true
    break
  else
    echo "Attempt $RETRY_COUNT failed:"
    echo "$ERROR_OUTPUT"
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "Waiting 15 seconds before retry..."
      sleep 15
    fi
  fi
done

if [ "$SUCCESS" != "true" ]; then
  echo ""
  echo "ERROR: Failed to set API Gateway Account CloudWatch Role after $MAX_RETRIES attempts."
  echo ""
  echo "Please verify:"
  echo "1. The role '$ROLE_NAME' exists and has the correct trust policy"
  echo "2. The role has CloudWatch Logs permissions"
  echo "3. Wait a few minutes for IAM changes to fully propagate, then try again"
  echo ""
  echo "You can verify the role with:"
  echo "  aws iam get-role --role-name $ROLE_NAME"
  echo "  aws iam get-role-policy --role-name $ROLE_NAME --policy-name CloudWatchLogsPolicy"
  exit 1
fi

# Wait a moment for changes to propagate
sleep 3

# Enable access logging on the stage
echo "Enabling access logging on stage..."
# Create patch operations file with proper JSON escaping
PATCH_OPS_FILE=$(mktemp)
cat > "$PATCH_OPS_FILE" <<'PATCHEOF'
[
  {
    "op": "replace",
    "path": "/accessLogSettings/destinationArn",
    "value": "PLACEHOLDER_DEST_ARN"
  },
  {
    "op": "replace",
    "path": "/accessLogSettings/format",
    "value": "{\"requestId\":\"$context.requestId\",\"ip\":\"$context.identity.sourceIp\",\"requestTime\":\"$context.requestTime\",\"httpMethod\":\"$context.httpMethod\",\"routeKey\":\"$context.routeKey\",\"status\":\"$context.status\",\"protocol\":\"$context.protocol\",\"responseLength\":\"$context.responseLength\",\"error.message\":\"$context.error.message\",\"error.messageString\":\"$context.error.messageString\",\"integration.error\":\"$context.integration.error\",\"integration.status\":\"$context.integration.status\"}"
  }
]
PATCHEOF

# Replace placeholder with actual ARN
sed -i.bak "s|PLACEHOLDER_DEST_ARN|arn:aws:logs:${REGION}:${ACCOUNT_ID}:log-group:${LOG_GROUP_NAME}|" "$PATCH_OPS_FILE"
rm -f "${PATCH_OPS_FILE}.bak"

aws apigateway update-stage \
  --rest-api-id "$API_GATEWAY_ID" \
  --stage-name "$STAGE_NAME" \
  --patch-operations file://"$PATCH_OPS_FILE" \
  --region ${REGION}

rm -f "$PATCH_OPS_FILE"

# Enable execution logging and data tracing on all methods
echo "Enabling execution logging on all methods..."
aws apigateway update-stage \
  --rest-api-id "$API_GATEWAY_ID" \
  --stage-name "$STAGE_NAME" \
  --patch-operations \
    'op=replace,path=/*/*/logging/dataTrace,value=true' \
    'op=replace,path=/*/*/logging/loglevel,value=INFO' \
    'op=replace,path=/*/*/metrics/enabled,value=true' \
  --region ${REGION}

echo ""
echo "API Gateway logging enabled successfully!"
echo ""
echo "Logs will appear in CloudWatch Log Group: $LOG_GROUP_NAME"
echo "View logs at: https://console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/${LOG_GROUP_NAME//\//\$252F}"
