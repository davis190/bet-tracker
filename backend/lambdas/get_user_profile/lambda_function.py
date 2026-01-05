"""Lambda function to get user profile with feature flags."""

import sys
import os

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response, options_response
from shared.auth import get_user_id_from_event, get_user_email_from_event
from shared.user_service import get_or_create_user_profile


def lambda_handler(event, context):
    """Handle GET /users/profile request."""
    # Handle OPTIONS request for CORS preflight
    http_method = (
        event.get("httpMethod") 
        or event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("requestContext", {}).get("httpMethod")
    )
    if http_method == "OPTIONS":
        return options_response()
    
    try:
        # Get user ID and email from event
        user_id = get_user_id_from_event(event)
        if not user_id:
            return error_response("Unauthorized", 401, "UNAUTHORIZED")
        
        user_email = get_user_email_from_event(event) or ""
        
        # Get or create user profile
        profile = get_or_create_user_profile(user_id, user_email)
        
        return success_response(profile)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

