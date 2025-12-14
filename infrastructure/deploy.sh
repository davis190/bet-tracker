#!/bin/bash

# Deployment script for Bet Tracker App CloudFormation stacks

set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME="bet-tracker"
# Note: Region must match the GitHub CodeStar Connections region (us-east-2)
REGION=${AWS_REGION:-us-east-1}

echo "Deploying Bet Tracker App infrastructure..."
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"

# Deploy main stack
echo "Deploying main stack..."
aws cloudformation deploy \
  --template-file cloudformation/main.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    ProjectName=${PROJECT_NAME} \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${REGION}

# Get outputs from main stack
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text \
  --region ${REGION})

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text \
  --region ${REGION})

API_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayId`].OutputValue' \
  --output text \
  --region ${REGION})

API_ROOT_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayRootResourceId`].OutputValue' \
  --output text \
  --region ${REGION})

AUTHORIZER_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoAuthorizerId`].OutputValue' \
  --output text \
  --region ${REGION})

BETS_TABLE_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`BetsTableName`].OutputValue' \
  --output text \
  --region ${REGION})

SAM_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
  --query 'Stacks[0].Outputs[?OutputKey==`SamArtifactsBucketName`].OutputValue' \
  --output text \
  --region ${REGION})

# Deploy frontend stack
echo "Deploying frontend stack..."
aws cloudformation deploy \
  --template-file cloudformation/frontend.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-frontend \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    ProjectName=${PROJECT_NAME} \
  --region ${REGION}

# Get frontend outputs
FRONTEND_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text \
  --region ${REGION})

CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-frontend \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text \
  --region ${REGION})

# Deploy lambda functions stack
echo "Deploying lambda functions stack..."
# Change to project root directory
cd "$(dirname "$0")/.."

# Prepare Lambda functions for SAM build
echo "Preparing Lambda functions for SAM build..."
shopt -s nullglob
for lambda_dir in backend/lambdas/*/; do
  [ -d "$lambda_dir" ] || continue
  lambda_name=$(basename "$lambda_dir")
  echo "Preparing $lambda_name..."
  # Copy shared code
  cp -r backend/shared "$lambda_dir/"
  # Copy requirements.txt if it doesn't exist or is empty
  if [ ! -f "$lambda_dir/requirements.txt" ] || [ ! -s "$lambda_dir/requirements.txt" ]; then
    cp backend/requirements.txt "$lambda_dir/requirements.txt"
  fi
done

# Check for Python 3.12 (required for Lambda runtime)
echo "Checking for Python 3.12..."
USE_CONTAINER=""
if ! command -v python3.12 &> /dev/null; then
  echo "python3.12 not found in PATH."
  if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "Using Docker container for build (avoids local Python version requirement)..."
    USE_CONTAINER="--use-container"
  else
    echo "ERROR: python3.12 not found and Docker is not available."
    echo "Please install python3.12 via pyenv:"
    echo "  pyenv install 3.12.0"
    echo "  pyenv local 3.12.0"
    echo "Or install and start Docker, then re-run this script."
    exit 1
  fi
fi

# Build with SAM
echo "Building Lambda functions with SAM..."
sam build --template infrastructure/cloudformation/lambda-functions.yaml --build-dir .aws-sam/build ${USE_CONTAINER}

# Package with SAM
echo "Packaging Lambda functions with SAM..."
# SAM build creates the template as template.yaml in the build directory
BUILT_TEMPLATE=".aws-sam/build/template.yaml"
if [ ! -f "$BUILT_TEMPLATE" ]; then
  echo "Error: Built template not found at $BUILT_TEMPLATE"
  echo "Searching for built template..."
  BUILT_TEMPLATE=$(find .aws-sam/build -name "*.yaml" -type f | head -1)
  if [ -z "$BUILT_TEMPLATE" ]; then
    echo "ERROR: Could not find built template in .aws-sam/build/"
    exit 1
  fi
  echo "Found template at: $BUILT_TEMPLATE"
fi

sam package \
  --template-file "${BUILT_TEMPLATE}" \
  --s3-bucket ${SAM_BUCKET_NAME} \
  --output-template-file infrastructure/packaged-lambda-functions.yaml \
  --region ${REGION}

# Deploy with SAM
echo "Deploying Lambda functions with SAM..."
sam deploy \
  --template-file infrastructure/packaged-lambda-functions.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-lambdas \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    ProjectName=${PROJECT_NAME} \
    ApiGatewayId=${API_GATEWAY_ID} \
    ApiGatewayRootResourceId=${API_ROOT_ID} \
    AuthorizerId=${AUTHORIZER_ID} \
    BetsTableName=${BETS_TABLE_NAME} \
    UserPoolId=${USER_POOL_ID} \
  --region ${REGION} \
  --no-fail-on-empty-changeset

# Change back to infrastructure directory
cd infrastructure

# Get API Gateway Custom Domain URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-lambdas \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayCustomUrl`].OutputValue' \
  --output text \
  --region ${REGION})
  
# If custom domain not found, try to get from main stack
if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
  echo "Custom domain URL not found in lambdas stack, trying main stack..."
  API_URL=$(aws cloudformation describe-stacks \
    --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-main \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayDomainNameValue`].OutputValue' \
    --output text \
    --region ${REGION})
  if [ -n "$API_URL" ] && [ "$API_URL" != "None" ]; then
    API_URL="https://${API_URL}"
  fi
fi

# Deploy CodeBuild stack
echo "Deploying CodeBuild stack..."
aws cloudformation deploy \
  --template-file cloudformation/codebuild.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-codebuild \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    ProjectName=${PROJECT_NAME} \
    FrontendBucketName=${FRONTEND_BUCKET} \
    CloudFrontDistributionId=${CLOUDFRONT_ID} \
    ApiGatewayId=${API_GATEWAY_ID} \
    BetsTableName=${BETS_TABLE_NAME} \
    UserPoolId=${USER_POOL_ID} \
    UserPoolClientId=${USER_POOL_CLIENT_ID} \
    SamArtifactsBucketName=${SAM_BUCKET_NAME} \
    GitHubConnectionArn=arn:aws:codeconnections:us-east-2:690641653089:connection/846dd1d9-a496-4520-8a3e-c9e365b4eb64 \
    GitHubBranch=main \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${REGION}

echo "Deployment complete!"
echo ""
echo "Outputs:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  API Gateway URL: $API_URL"
echo "  Frontend Bucket: $FRONTEND_BUCKET"
echo "  CloudFront Distribution ID: $CLOUDFRONT_ID"

