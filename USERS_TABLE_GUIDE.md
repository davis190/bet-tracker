# How to Populate the Users Table

The Users table in DynamoDB stores user profiles with feature flags and roles. Here are several ways to populate it:

## Understanding the Setup

- **Cognito User Pool**: Handles authentication (signup/login)
- **DynamoDB Users Table**: Stores user profiles with feature flags and roles
- These are separate - a user can exist in Cognito but not in DynamoDB

## Method 1: Automatic Creation (Recommended)

Users are automatically created in the DynamoDB Users table when they:
1. Sign up in Cognito (via frontend or AWS CLI)
2. Log in through the app
3. Access the `/users/profile` endpoint (which calls `get_or_create_user_profile`)

**Flow:**
- User signs up → Cognito creates the user
- User logs in → Frontend makes API call to get profile
- Lambda function checks if profile exists → If not, creates it with default role "user"

This happens automatically - no manual intervention needed!

## Method 2: Create Users via AWS CLI

### Step 1: Create User in Cognito

```bash
# Get your User Pool ID from CloudFormation outputs
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name bet-tracker-dev-main \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create a user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --password YourSecurePassword123! \
  --permanent
```

### Step 2: Create Profile in DynamoDB

The profile will be auto-created on first API access, OR you can create it manually:

```bash
# Get Users table name
USERS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name bet-tracker-dev-main \
  --query 'Stacks[0].Outputs[?OutputKey==`UsersTableName`].OutputValue' \
  --output text)

# Get the user's Cognito sub (ID) - replace USER_EMAIL with the email
USER_ID=$(aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --query 'UserAttributes[?Name==`sub`].Value' \
  --output text)

# Create user profile in DynamoDB
aws dynamodb put-item \
  --table-name $USERS_TABLE \
  --item '{
    "userId": {"S": "'$USER_ID'"},
    "email": {"S": "user@example.com"},
    "role": {"S": "user"},
    "featureFlags": {
      "M": {
        "canCreateBets": {"BOOL": true},
        "canManageBets": {"BOOL": false},
        "canDeleteBets": {"BOOL": false},
        "canClearWeek": {"BOOL": false},
        "canBetslipImport": {"BOOL": false}
      }
    },
    "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
    "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

### Create Admin User

To create an admin user, change the role to "admin":

```bash
aws dynamodb put-item \
  --table-name $USERS_TABLE \
  --item '{
    "userId": {"S": "'$USER_ID'"},
    "email": {"S": "admin@example.com"},
    "role": {"S": "admin"},
    "featureFlags": {
      "M": {
        "canCreateBets": {"BOOL": true},
        "canManageBets": {"BOOL": true},
        "canDeleteBets": {"BOOL": true},
        "canClearWeek": {"BOOL": true},
        "canBetslipImport": {"BOOL": true}
      }
    },
    "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
    "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

## Method 3: Python Script

Create a script to populate users programmatically:

```python
#!/usr/bin/env python3
"""Script to create users in DynamoDB Users table."""

import boto3
import os
from datetime import datetime

# Configuration
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev')
PROJECT_NAME = 'bet-tracker'
REGION = os.getenv('AWS_REGION', 'us-east-1')

# Initialize clients
cloudformation = boto3.client('cloudformation', region_name=REGION)
cognito = boto3.client('cognito-idp', region_name=REGION)
dynamodb = boto3.resource('dynamodb', region_name=REGION)

def get_stack_output(stack_name, output_key):
    """Get CloudFormation stack output."""
    response = cloudformation.describe_stacks(StackName=stack_name)
    outputs = response['Stacks'][0]['Outputs']
    for output in outputs:
        if output['OutputKey'] == output_key:
            return output['OutputValue']
    return None

def create_user_profile(email, role='user'):
    """Create a user in Cognito and DynamoDB."""
    stack_name = f'{PROJECT_NAME}-{ENVIRONMENT}-main'
    
    # Get User Pool ID and Table Name
    user_pool_id = get_stack_output(stack_name, 'UserPoolId')
    users_table_name = get_stack_output(stack_name, 'UsersTableName')
    
    if not user_pool_id or not users_table_name:
        print(f"Error: Could not find stack outputs for {stack_name}")
        return
    
    print(f"Creating user: {email} with role: {role}")
    
    # Create user in Cognito
    try:
        response = cognito.admin_get_user(
            UserPoolId=user_pool_id,
            Username=email
        )
        user_id = None
        for attr in response['UserAttributes']:
            if attr['Name'] == 'sub':
                user_id = attr['Value']
                break
        print(f"User already exists in Cognito: {user_id}")
    except cognito.exceptions.UserNotFoundException:
        print("User not found in Cognito. Please create user in Cognito first.")
        return
    
    # Create/update profile in DynamoDB
    table = dynamodb.Table(users_table_name)
    
    feature_flags = {
        "canCreateBets": True,
        "canManageBets": role == "admin",
        "canDeleteBets": role == "admin",
        "canClearWeek": role == "admin",
        "canBetslipImport": role == "admin",
    }
    
    now = datetime.utcnow().isoformat() + "Z"
    
    item = {
        "userId": user_id,
        "email": email,
        "role": role,
        "featureFlags": feature_flags,
        "createdAt": now,
        "updatedAt": now,
    }
    
    table.put_item(Item=item)
    print(f"✓ Created user profile in DynamoDB for {email}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python create_user.py <email> [role]")
        print("Example: python create_user.py user@example.com user")
        print("Example: python create_user.py admin@example.com admin")
        sys.exit(1)
    
    email = sys.argv[1]
    role = sys.argv[2] if len(sys.argv) > 2 else 'user'
    
    create_user_profile(email, role)
```

## Method 4: Update Existing User Role

To promote an existing user to admin:

```bash
# Get user ID from Cognito
USER_ID=$(aws cognito-idp admin-get-user \
  --user-pool-id $USER_POOL_ID \
  --username user@example.com \
  --query 'UserAttributes[?Name==`sub`].Value' \
  --output text)

# Update role and feature flags
aws dynamodb update-item \
  --table-name $USERS_TABLE \
  --key '{"userId": {"S": "'$USER_ID'"}}' \
  --update-expression "SET #role = :role, #featureFlags = :flags, #updatedAt = :updated" \
  --expression-attribute-names '{
    "#role": "role",
    "#featureFlags": "featureFlags",
    "#updatedAt": "updatedAt"
  }' \
  --expression-attribute-values '{
    ":role": {"S": "admin"},
    ":flags": {
      "M": {
        "canCreateBets": {"BOOL": true},
        "canManageBets": {"BOOL": true},
        "canDeleteBets": {"BOOL": true},
        "canClearWeek": {"BOOL": true},
        "canBetslipImport": {"BOOL": true}
      }
    },
    ":updated": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }'
```

## User Roles and Feature Flags

### User Role: "user"
- `canCreateBets`: true
- `canManageBets`: false
- `canDeleteBets`: false
- `canClearWeek`: false
- `canBetslipImport`: false

### User Role: "admin"
- `canCreateBets`: true
- `canManageBets`: true
- `canDeleteBets`: true
- `canClearWeek`: true
- `canBetslipImport`: true

## Quick Reference

### Get all users in the table
```bash
aws dynamodb scan --table-name $USERS_TABLE
```

### Get specific user profile
```bash
aws dynamodb get-item \
  --table-name $USERS_TABLE \
  --key '{"userId": {"S": "USER_ID_HERE"}}'
```

### Delete a user profile
```bash
aws dynamodb delete-item \
  --table-name $USERS_TABLE \
  --key '{"userId": {"S": "USER_ID_HERE"}}'
```

## Notes

- The `userId` in DynamoDB must match the Cognito `sub` (subject) attribute
- Users are created automatically when they first access `/users/profile` endpoint
- Feature flags control what users can do in the application
- Role changes automatically update feature flags to defaults for that role

