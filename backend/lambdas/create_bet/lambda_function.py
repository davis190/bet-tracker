"""Lambda function to create a new bet."""

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
from shared.dynamodb import create_bet
from shared.bet_validator import validate_bet, validate_single_bet, validate_parlay


def lambda_handler(event, context):
    """Handle POST /bets request."""
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
        
        # Validate bet data
        is_valid, error_message = validate_bet(body)
        if not is_valid:
            return error_response(error_message, 400, "VALIDATION_ERROR")
        
        # Create bet
        bet = create_bet(user_id, body)
        
        return success_response(bet, 201)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

