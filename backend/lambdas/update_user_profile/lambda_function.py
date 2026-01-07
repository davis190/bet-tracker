"""Lambda function to update user profile (admin only)."""

import sys
import os
import json

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

import boto3
from botocore.exceptions import ClientError

from shared.responses import success_response, error_response, options_response
from shared.auth import get_user_id_from_event, get_user_email_from_event
from shared.user_service import update_user_profile, is_admin, get_user_profile, create_user_profile


def lambda_handler(event, context):
    """Handle PUT /users/profile request."""
    # Handle OPTIONS request for CORS preflight
    http_method = (
        event.get("httpMethod") 
        or event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("requestContext", {}).get("httpMethod")
    )
    if http_method == "OPTIONS":
        return options_response()
    
    try:
        print(f"update_user_profile lambda_handler: Starting request")
        print(f"Event: {json.dumps(event, default=str)}")
        
        # Get user ID from event
        user_id = get_user_id_from_event(event)
        print(f"update_user_profile: user_id from event = {user_id}")
        if not user_id:
            print("update_user_profile: No user_id found in event")
            return error_response("Unauthorized", 401, "UNAUTHORIZED")
        
        # Parse request body
        try:
            body = json.loads(event.get("body", "{}"))
            print(f"update_user_profile: Parsed request body: {json.dumps(body, default=str)}")
        except json.JSONDecodeError as e:
            print(f"update_user_profile: JSON decode error: {str(e)}")
            return error_response("Invalid JSON in request body", 400, "INVALID_JSON")
        
        # Get target user ID (defaults to self)
        target_user_id = body.get("userId", user_id)
        print(f"update_user_profile: target_user_id = {target_user_id}, is_admin check for {user_id}")
        
        # Check permissions:
        # - Admins can update any user's profile (including aliases)
        # - Regular users cannot update anything (aliases can only be managed by admins)
        is_user_admin = is_admin(user_id)
        is_updating_self = (target_user_id == user_id)
        
        if not is_user_admin:
            # Regular users cannot update anything, including their own aliases
            return error_response("Forbidden: Only administrators can update user profiles", 403, "FORBIDDEN")
        
        # Check if target user profile exists, create if it doesn't
        print(f"update_user_profile: Checking if profile exists for user_id={target_user_id}")
        target_profile = get_user_profile(target_user_id)
        print(f"update_user_profile: Profile exists: {target_profile is not None}")
        if not target_profile:
            # Profile doesn't exist, create it first
            # Try to get email from request body or from current user's event
            target_email = body.get("email")
            if not target_email and is_updating_self:
                # If updating self and no email in body, try to get from event
                target_email = get_user_email_from_event(event)
            
            # If still no email, try to fetch from Cognito
            if not target_email:
                try:
                    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
                    if user_pool_id:
                        cognito_client = boto3.client("cognito-idp")
                        # Try to find user by sub (user ID)
                        # Since usernameAttributes is email, we need to list users and filter
                        try:
                            # First, try admin_get_user with the user_id (sub) - this might work
                            response = cognito_client.admin_get_user(
                                UserPoolId=user_pool_id,
                                Username=target_user_id
                            )
                            # Extract email from attributes
                            for attr in response.get("UserAttributes", []):
                                if attr.get("Name") == "email":
                                    target_email = attr.get("Value")
                                    break
                        except ClientError:
                            # If that fails, try listing users with filter
                            # Note: This requires pagination for large user pools
                            paginator = cognito_client.get_paginator('list_users')
                            for page in paginator.paginate(
                                UserPoolId=user_pool_id,
                                Filter=f'sub = "{target_user_id}"'
                            ):
                                for user in page.get("Users", []):
                                    for attr in user.get("Attributes", []):
                                        if attr.get("Name") == "email":
                                            target_email = attr.get("Value")
                                            break
                                    if target_email:
                                        break
                                if target_email:
                                    break
                except (ClientError, Exception) as e:
                    print(f"Could not fetch email from Cognito: {str(e)}")
                    # Continue - will return error if email still not found
            
            if not target_email:
                return error_response(
                    "User profile not found and email is required to create it. Please provide email in request body.",
                    400,
                    "EMAIL_REQUIRED"
                )
            
            # Get role from body or default to "user"
            default_role = body.get("role", "user")
            
            # Create the profile with defaults
            print(f"update_user_profile: Creating profile for user_id={target_user_id}, email={target_email}, role={default_role}")
            target_profile = create_user_profile(target_user_id, target_email, role=default_role)
            print(f"update_user_profile: Profile created: {target_profile is not None}")
        
        # Extract updates (exclude userId and email from updates)
        updates = {k: v for k, v in body.items() if k not in ["userId", "email"]}
        print(f"update_user_profile: Updates to apply: {json.dumps(updates, default=str)}")
        
        if not updates:
            # No updates to make (or only userId/email were provided)
            print("update_user_profile: No updates to make, returning existing profile")
            return success_response(target_profile)
        
        # Validate aliases if provided
        if "aliases" in updates:
            aliases = updates["aliases"]
            if not isinstance(aliases, list):
                return error_response("Aliases must be a list", 400, "VALIDATION_ERROR")
            # Validate each alias is a string
            for alias in aliases:
                if not isinstance(alias, str) or not alias.strip():
                    return error_response("All aliases must be non-empty strings", 400, "VALIDATION_ERROR")
        
        # Update user profile
        print(f"update_user_profile: Calling update_user_profile with user_id={target_user_id}, updates={json.dumps(updates, default=str)}")
        try:
            updated_profile = update_user_profile(target_user_id, updates)
            print(f"update_user_profile: update_user_profile returned: {updated_profile is not None}")
            
            if not updated_profile:
                print(f"update_user_profile: ERROR - update_user_profile returned None for user_id={target_user_id}")
                return error_response("Failed to update user profile - update returned None", 500, "UPDATE_FAILED")
            
            print(f"update_user_profile: Successfully updated profile for user_id={target_user_id}")
            return success_response(updated_profile)
        except Exception as update_error:
            print(f"update_user_profile: Exception during update_user_profile call: {type(update_error).__name__}: {str(update_error)}")
            import traceback
            print(f"update_user_profile: Traceback: {traceback.format_exc()}")
            return error_response(
                f"Failed to update user profile: {type(update_error).__name__}: {str(update_error)}",
                500,
                "UPDATE_FAILED"
            )
    
    except Exception as e:
        print(f"update_user_profile: Unhandled exception: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"update_user_profile: Traceback: {traceback.format_exc()}")
        return error_response(f"Internal server error: {type(e).__name__}: {str(e)}", 500, "INTERNAL_ERROR")

