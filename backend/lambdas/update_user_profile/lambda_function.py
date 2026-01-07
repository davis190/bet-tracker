"""Lambda function to update user profile (admin only)."""

import sys
import os
import json

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response, options_response
from shared.auth import get_user_id_from_event
from shared.user_service import update_user_profile, is_admin


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
        # Get user ID from event
        user_id = get_user_id_from_event(event)
        if not user_id:
            return error_response("Unauthorized", 401, "UNAUTHORIZED")
        
        # Parse request body
        try:
            body = json.loads(event.get("body", "{}"))
        except json.JSONDecodeError:
            return error_response("Invalid JSON in request body", 400, "INVALID_JSON")
        
        # Get target user ID (defaults to self)
        target_user_id = body.get("userId", user_id)
        
        # Check permissions:
        # - Admins can update any user's profile (including aliases)
        # - Regular users cannot update anything (aliases can only be managed by admins)
        is_user_admin = is_admin(user_id)
        is_updating_self = (target_user_id == user_id)
        
        if not is_user_admin:
            # Regular users cannot update anything, including their own aliases
            return error_response("Forbidden: Only administrators can update user profiles", 403, "FORBIDDEN")
        
        # Extract updates (exclude userId from updates)
        updates = {k: v for k, v in body.items() if k != "userId"}
        
        if not updates:
            return error_response("No updates provided", 400, "VALIDATION_ERROR")
        
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
        updated_profile = update_user_profile(target_user_id, updates)
        
        if not updated_profile:
            return error_response("User profile not found", 404, "NOT_FOUND")
        
        return success_response(updated_profile)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

