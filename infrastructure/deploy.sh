#!/bin/bash

# Deployment script for Bet Tracker App CloudFormation stacks

set -e

ENVIRONMENT=${1:-dev}
PROJECT_NAME="bet-tracker"
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
aws cloudformation deploy \
  --template-file cloudformation/lambda-functions.yaml \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-lambdas \
  --parameter-overrides \
    Environment=${ENVIRONMENT} \
    ProjectName=${PROJECT_NAME} \
    ApiGatewayId=${API_GATEWAY_ID} \
    ApiGatewayRootResourceId=${API_ROOT_ID} \
    AuthorizerId=${AUTHORIZER_ID} \
    BetsTableName=${BETS_TABLE_NAME} \
    UserPoolId=${USER_POOL_ID} \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ${REGION}

# Get API Gateway URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name ${PROJECT_NAME}-${ENVIRONMENT}-lambdas \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
  --output text \
  --region ${REGION})

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

