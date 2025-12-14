"""Lambda function to update a bet."""

import sys
import os
import json

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response
from shared.auth import get_user_id_from_event
from shared.dynamodb import get_bet_by_id, update_bet


def lambda_handler(event, context):
    """Handle PUT /bets/{betId} request."""
    try:
        # Get user ID from event
        user_id = get_user_id_from_event(event)
        if not user_id:
            return error_response("Unauthorized", 401, "UNAUTHORIZED")
        
        # Get bet ID from path parameters
        bet_id = event.get("pathParameters", {}).get("betId")
        if not bet_id:
            return error_response("Missing betId in path", 400, "MISSING_BET_ID")
        
        # Verify bet belongs to user
        existing_bet = get_bet_by_id(user_id, bet_id)
        if not existing_bet:
            return error_response("Bet not found", 404, "BET_NOT_FOUND")
        
        # Parse request body
        try:
            updates = json.loads(event.get("body", "{}"))
        except json.JSONDecodeError:
            return error_response("Invalid JSON in request body", 400, "INVALID_JSON")
        
        # Validate status if provided
        if "status" in updates:
            valid_statuses = ["pending", "won", "lost"]
            if updates["status"] not in valid_statuses:
                return error_response(
                    f"Invalid status. Must be one of: {', '.join(valid_statuses)}",
                    400,
                    "INVALID_STATUS",
                )
        
        # Validate legs if provided (for parlays)
        if "legs" in updates:
            if not isinstance(updates["legs"], list):
                return error_response("Legs must be a list", 400, "INVALID_LEGS")
            
            valid_statuses = ["pending", "won", "lost"]
            for i, leg in enumerate(updates["legs"]):
                if not isinstance(leg, dict):
                    return error_response(f"Leg {i+1} must be an object", 400, "INVALID_LEG")
                
                # Validate leg status if provided
                if "status" in leg:
                    if leg["status"] not in valid_statuses:
                        return error_response(
                            f"Leg {i+1}: Invalid status. Must be one of: {', '.join(valid_statuses)}",
                            400,
                            "INVALID_LEG_STATUS",
                        )
        
        # Update bet
        updated_bet = update_bet(user_id, bet_id, updates)
        
        if not updated_bet:
            return error_response("Failed to update bet", 500, "UPDATE_FAILED")
        
        return success_response(updated_bet)
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return error_response(f"Internal server error: {str(e)}", 500, "INTERNAL_ERROR")

