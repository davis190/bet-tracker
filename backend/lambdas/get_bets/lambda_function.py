"""Lambda function to get bets for authenticated user."""

import sys
import os

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response
from shared.auth import get_user_id_from_event
from shared.dynamodb import get_bets_by_user


def lambda_handler(event, context):
    """Handle GET /bets request."""
    try:
        # Get user ID from event
        user_id = get_user_id_from_event(event)
        if not user_id:
            return error_response("Unauthorized", 401, "UNAUTHORIZED")
        
        # Get query parameters
        query_params = event.get("queryStringParameters") or {}
        status = query_params.get("status")
        start_date = query_params.get("startDate")
        end_date = query_params.get("endDate")
        bet_type = query_params.get("type")
        
        # Get bets
        bets = get_bets_by_user(
            user_id=user_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
            bet_type=bet_type,
        )
        
        return success_response({"bets": bets})
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

