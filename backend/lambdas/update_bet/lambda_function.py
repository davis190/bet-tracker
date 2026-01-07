"""Lambda function to update a bet."""

import sys
import os
import json

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shared')
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.responses import success_response, error_response, options_response
from shared.auth import (
    get_user_id_from_event,
    check_can_edit_bet,
    check_can_mark_featured,
    check_can_mark_win_loss,
    check_feature_flag,
)
from shared.dynamodb import get_bet_by_id, update_bet


def lambda_handler(event, context):
    """Handle PUT /bets/{betId} request."""
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
        
        # Check edit permissions
        edit_permissions = check_can_edit_bet(user_id, existing_bet)
        print(f"update_bet: user_id={user_id}, bet_id={bet_id}, edit_permissions={edit_permissions}")
        if not edit_permissions.get("can_edit_overall", False):
            print(f"update_bet: Permission denied - can_edit_overall={edit_permissions.get('can_edit_overall')}")
            return error_response("Forbidden: You don't have permission to edit this bet", 403, "FORBIDDEN")
        
        # For parlays, check if user can edit specific parts
        bet_type = existing_bet.get("type", "single")
        if bet_type == "parlay":
            can_edit_legs = edit_permissions.get("can_edit_legs", [])
            # Check if user is trying to update legs they can't edit
            if "legs" in updates:
                if not isinstance(updates["legs"], list):
                    return error_response("Legs must be a list", 400, "INVALID_LEGS")
                
                existing_legs = existing_bet.get("legs", [])
                if len(updates["legs"]) != len(existing_legs):
                    return error_response("Cannot change number of legs", 400, "INVALID_LEGS")
                
                # Check each leg that's being updated
                for i, updated_leg in enumerate(updates["legs"]):
                    if not can_edit_legs[i]:
                        # User is trying to edit a leg they don't have permission for
                        # Check if they're actually changing anything
                        existing_leg = existing_legs[i]
                        # Compare key fields that can be edited
                        leg_changed = False
                        for key in ["teams", "sport", "betType", "selection", "odds", "attributedTo"]:
                            if updated_leg.get(key) != existing_leg.get(key):
                                leg_changed = True
                                break
                        
                        if leg_changed:
                            return error_response(
                                f"Forbidden: You don't have permission to edit leg {i+1}",
                                403,
                                "FORBIDDEN"
                            )
                
                # Check if user is trying to update overall parlay fields they can't edit
                if not edit_permissions.get("can_edit_overall", False):
                    # Check if any overall fields are being updated
                    overall_fields = ["amount", "date", "attributedTo"]
                    for field in overall_fields:
                        if field in updates:
                            return error_response(
                                f"Forbidden: You don't have permission to edit the parlay's {field}",
                                403,
                                "FORBIDDEN"
                            )
        
        # Check permission to mark as featured
        if "featured" in updates:
            if not check_can_mark_featured(user_id, existing_bet):
                return error_response("Forbidden: You don't have permission to mark this bet as featured", 403, "FORBIDDEN")
        
        # Check permission to mark win/loss
        if "status" in updates:
            win_loss_permissions = check_can_mark_win_loss(user_id, existing_bet)
            if not win_loss_permissions.get("can_mark_overall", False):
                return error_response("Forbidden: You don't have permission to mark this bet's status", 403, "FORBIDDEN")
        
        # Check permission to mark leg statuses (for parlays)
        if "legs" in updates and bet_type == "parlay":
            win_loss_permissions = check_can_mark_win_loss(user_id, existing_bet)
            can_mark_legs = win_loss_permissions.get("can_mark_legs", [])
            existing_legs = existing_bet.get("legs", [])
            
            for i, updated_leg in enumerate(updates["legs"]):
                if "status" in updated_leg:
                    if i >= len(can_mark_legs) or not can_mark_legs[i]:
                        existing_leg_status = existing_legs[i].get("status", "pending")
                        if updated_leg.get("status") != existing_leg_status:
                            return error_response(
                                f"Forbidden: You don't have permission to mark leg {i+1}'s status",
                                403,
                                "FORBIDDEN"
                            )
        
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

