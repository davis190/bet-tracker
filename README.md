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

### Manual Deployment (One-Time Infrastructure Setup)

**You only need to do this once** to set up the AWS infrastructure. After this, CodeBuild will handle all application deployments automatically.

Deploy all CloudFormation stacks:

```bash
cd infrastructure
./deploy.sh dev  # or staging, prod
```

This script deploys the following stacks in order:
1. **main.yaml** - Cognito User Pool, DynamoDB Table, API Gateway, SAM Artifacts Bucket
2. **frontend.yaml** - S3 Bucket for frontend, CloudFront Distribution
3. **lambda-functions.yaml** - Lambda functions with API Gateway integration
4. **codebuild.yaml** - CodeBuild project for CI/CD

After deployment, the script will output:
- User Pool ID and Client ID (for frontend configuration)
- API Gateway URL
- Frontend Bucket name
- CloudFront Distribution ID

### Configure Frontend Environment Variables

After the infrastructure is deployed, create `frontend/.env.local` with values from the CloudFormation outputs:

```env
VITE_API_ENDPOINT=https://bets-api.claytondavis.dev
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_AWS_REGION=us-east-1
```

### Automatic Deployment (CodeBuild)

Once the infrastructure is set up, **CodeBuild automatically handles all deployments** when you push code to your repository:

1. **Lambda Functions**: Built with SAM and deployed using `sam deploy`
2. **Frontend**: Built with Vite and deployed to S3, then CloudFront cache is invalidated

The `buildspec.yml` file defines the build process. The CodeBuild project is configured with all necessary environment variables from the CloudFormation stacks.

**No manual deployment needed after initial setup!** Just push your code and CodeBuild will deploy it.

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

