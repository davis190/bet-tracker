"""Lambda function to get bets - public view or for authenticated user."""

import sys
import os

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response, options_response
from shared.auth import get_user_id_from_event, check_can_see_manage_bets_page, _is_bet_visible_to_user, _get_user_aliases
from shared.dynamodb import get_bets_by_user, get_all_bets


def lambda_handler(event, context):
    """Handle GET /bets request."""
    # Log the incoming request for debugging
    print(f"Received request: httpMethod={event.get('httpMethod')}, path={event.get('path')}")
    print(f"Request context: {event.get('requestContext', {})}")
    
    # Handle OPTIONS request for CORS preflight
    http_method = (
        event.get("httpMethod") 
        or event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("requestContext", {}).get("httpMethod")
    )
    if http_method == "OPTIONS":
        print("Handling OPTIONS request - returning CORS response")
        return options_response()
    
    try:
        # Get user ID from event (may be None for public access)
        user_id = get_user_id_from_event(event)
        
        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        status = query_params.get("status")
        start_date = query_params.get("startDate")
        end_date = query_params.get("endDate")
        bet_type = query_params.get("type")
        
        # If authenticated, check permissions and get bets
        if user_id:
            # Check if user can see manage bets page
            can_see = check_can_see_manage_bets_page(user_id)
            if not can_see:
                return error_response("Forbidden: You don't have permission to view bets", 403, "FORBIDDEN")
            
            # Get user's bets
            bets = get_bets_by_user(
                user_id=user_id,
                status=status,
                start_date=start_date,
                end_date=end_date,
                bet_type=bet_type,
            )
            
            # If user only has "Own" permission, filter bets by visibility
            has_global_permission = False
            try:
                from shared.auth import check_feature_flag
                has_global_permission = check_feature_flag(user_id, "seeManageBetsPage")
            except Exception:
                pass
            
            if not has_global_permission:
                # User has "Own" permission - filter bets
                # First, ensure bets belong to this user (defensive check)
                bets = [bet for bet in bets if bet.get("userId") == user_id]
                # Then filter by attribution visibility
                user_aliases = _get_user_aliases(user_id)
                bets = [bet for bet in bets if _is_bet_visible_to_user(bet, user_aliases)]
        else:
            # Public access - get all bets
            bets = get_all_bets(
                status=status,
                start_date=start_date,
                end_date=end_date,
                bet_type=bet_type,
            )
        
        return success_response({"bets": bets})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

