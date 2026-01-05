"""Lambda function to delete a bet."""

import sys
import os

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response, options_response
from shared.auth import get_user_id_from_event, require_feature_flag
from shared.dynamodb import get_bet_by_id, delete_bet


def lambda_handler(event, context):
    """Handle DELETE /bets/{betId} request."""
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
        
        # Check feature flag
        try:
            require_feature_flag(user_id, "canDeleteBets")
        except PermissionError as e:
            return error_response(str(e), 403, "FORBIDDEN")
        
        # Get bet ID from path parameters
        bet_id = event.get("pathParameters", {}).get("betId")
        if not bet_id:
            return error_response("Missing betId in path", 400, "MISSING_BET_ID")
        
        # Verify bet belongs to user
        existing_bet = get_bet_by_id(user_id, bet_id)
        if not existing_bet:
            return error_response("Bet not found", 404, "BET_NOT_FOUND")
        
        # Delete bet
        success = delete_bet(user_id, bet_id)
        
        if not success:
            return error_response("Failed to delete bet", 500, "DELETE_FAILED")
        
        return success_response({"message": "Bet deleted successfully"})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

