# Bet Tracker App

A serverless sports bet tracking application built with AWS Lambda, API Gateway, DynamoDB, React, and CloudFront.

## Architecture

- **Backend**: Python Lambda functions behind API Gateway
- **Frontend**: React (Vite) with TypeScript, hosted in S3 behind CloudFront
- **Authentication**: AWS Cognito
- **Database**: AWS DynamoDB
- **Infrastructure**: CloudFormation templates
- **CI/CD**: AWS CodeBuild

## Features

- **Single Bets**: Track individual bets (e.g., Colts @ Seahawks Over 44.5)
- **Parlays**: Track multi-leg parlays (e.g., Panthers to win AND Over 40.5)
- **Admin Interface**: Create, update, and manage bets (requires login)
- **Public Dashboard**: View all bets and statistics (mobile and TV optimized)
- **Week Management**: Clear all bets for the current week

## Prerequisites

- AWS CLI configured
- Node.js 18+ and npm
- Python 3.11
- AWS account with appropriate permissions

## Deployment

### 1. Deploy Infrastructure

Deploy CloudFormation stacks:

```bash
cd infrastructure
./deploy.sh dev
```

This will create:
- Cognito User Pool
- DynamoDB Table
- API Gateway
- Lambda Functions
- S3 Bucket and CloudFront Distribution
- CodeBuild Project

### 2. Configure Frontend Environment Variables

Create `frontend/.env.local`:

```env
VITE_API_ENDPOINT=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_AWS_REGION=us-east-1
```

### 3. Package and Deploy Lambda Functions

```bash
cd backend
pip install -r requirements.txt -t .

# Package each Lambda function
cd lambdas/get_bets
zip -r ../../../dist/get_bets.zip . -x "*.pyc" -x "__pycache__/*"
# Repeat for other Lambda functions

# Deploy using AWS CLI
aws lambda update-function-code --function-name bet-tracker-dev-get-bets --zip-file fileb://../../dist/get_bets.zip
```

### 4. Build and Deploy Frontend

```bash
cd frontend
npm install
npm run build

# Deploy to S3
aws s3 sync dist s3://bet-tracker-dev-frontend-<account-id> --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id <distribution-id> --paths "/*"
```

## CodeBuild Deployment

The project includes a `buildspec.yml` for automated deployments via CodeBuild. Configure CodeBuild to:
1. Use the buildspec.yml file
2. Set environment variables from CloudFormation outputs
3. Deploy on code push to your repository

## Local Development

### Backend

```bash
cd backend
pip install -r requirements.txt
# Test Lambda functions locally using SAM or Lambda runtime interface emulator
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Usage

1. Create a user in Cognito User Pool
2. Login at `/login`
3. Add bets via the Admin interface at `/admin`
4. View dashboard at `/` (public)

## Project Structure

```
bet-tracker-app/
├── infrastructure/        # CloudFormation templates
├── backend/              # Lambda functions and shared code
├── frontend/             # React application
└── buildspec.yml         # CodeBuild configuration
```

## License

MIT

