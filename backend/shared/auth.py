"""Cognito JWT token validation utilities."""

from typing import Dict, Optional, List, Any


def get_user_id_from_event(event: Dict) -> Optional[str]:
    """
    Extract user ID from API Gateway event with Cognito authorizer.
    
    API Gateway validates the JWT token before invoking the Lambda function,
    so we can directly extract the user ID from the claims.
    
    Args:
        event: API Gateway event
    
    Returns:
        User ID (sub claim) or None if not found
    """
    try:
        # Cognito authorizer adds claims to requestContext.authorizer.claims
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        user_id = claims.get("sub")
        return user_id
    except Exception:
        return None


def get_user_email_from_event(event: Dict) -> Optional[str]:
    """
    Extract user email from API Gateway event with Cognito authorizer.
    
    Args:
        event: API Gateway event
    
    Returns:
        User email or None if not found
    """
    try:
        # Cognito authorizer adds claims to requestContext.authorizer.claims
        claims = event.get("requestContext", {}).get("authorizer", {}).get("claims", {})
        email = claims.get("email")
        return email
    except Exception:
        return None


def get_username_from_email(email: Optional[str]) -> Optional[str]:
    """
    Extract username from email (everything before @).
    
    Args:
        email: User email address
    
    Returns:
        Username (part before @) or None if email is invalid
    """
    if not email or "@" not in email:
        return None
    return email.split("@")[0]


def check_feature_flag(user_id: str, flag_name: str) -> bool:
    """
    Check if user has a specific feature flag enabled.
    
    Args:
        user_id: Cognito user ID
        flag_name: Name of the feature flag to check
    
    Returns:
        True if flag is enabled, False otherwise
    """
    try:
        from .user_service import check_feature_flag as _check_feature_flag
        result = _check_feature_flag(user_id, flag_name)
        print(f"check_feature_flag: user_id={user_id}, flag_name={flag_name}, result={result}")
        return result
    except Exception as e:
        print(f"check_feature_flag exception: user_id={user_id}, flag_name={flag_name}, error={str(e)}")
        return False


def require_feature_flag(user_id: str, flag_name: str) -> None:
    """
    Require a feature flag to be enabled, raise exception if not.
    
    Args:
        user_id: Cognito user ID
        flag_name: Name of the feature flag to check
    
    Raises:
        PermissionError: If the feature flag is not enabled
    """
    if not check_feature_flag(user_id, flag_name):
        raise PermissionError(f"Feature flag '{flag_name}' is required but not enabled for this user")


def _get_user_aliases(user_id: str) -> List[str]:
    """
    Get user's aliases from profile.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        List of user aliases
    """
    try:
        from .user_service import get_user_aliases
        return get_user_aliases(user_id)
    except Exception:
        return []


def _is_attributed_to_user(attributed_to: Optional[str], user_aliases: List[str]) -> bool:
    """
    Check if attribution matches any of the user's aliases.
    
    Args:
        attributed_to: Attribution string from bet/leg
        user_aliases: List of user's aliases
    
    Returns:
        True if attribution matches any alias, False otherwise
    """
    if not attributed_to or not user_aliases:
        return False
    
    return attributed_to in user_aliases


def _is_bet_visible_to_user(bet: Dict, user_aliases: List[str]) -> bool:
    """
    Check if bet should be visible to user based on attribution.
    For parlays, checks parlay's attributedTo OR any leg's attributedTo.
    For single bets, checks bet's attributedTo.
    
    Args:
        bet: Bet dictionary
        user_aliases: List of user's aliases
    
    Returns:
        True if bet should be visible, False otherwise
    """
    if not user_aliases:
        return False
    
    bet_type = bet.get("type", "single")
    
    if bet_type == "single":
        # For single bets, check bet's attributedTo
        return _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
    else:  # parlay
        # For parlays, check parlay's attributedTo OR any leg's attributedTo
        parlay_attributed_to = bet.get("attributedTo")
        if _is_attributed_to_user(parlay_attributed_to, user_aliases):
            return True
        
        # Check legs
        legs = bet.get("legs", [])
        for leg in legs:
            if _is_attributed_to_user(leg.get("attributedTo"), user_aliases):
                return True
        
        return False


def check_can_see_manage_bets_page(user_id: str) -> bool:
    """
    Check if user can see the manage bets page.
    Checks global permission first, then "Own" permission.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        True if user can see the page, False otherwise
    """
    # Global permission takes precedence
    if check_feature_flag(user_id, "seeManageBetsPage"):
        return True
    
    # Check "Own" permission
    return check_feature_flag(user_id, "seeManageBetsPageOwn")


def check_can_edit_bet(user_id: str, bet: Dict) -> Dict[str, Any]:
    """
    Check if user can edit a bet and which parts they can edit.
    Returns granular permissions for overall bet and individual legs.
    
    Permissions are required for ALL bets, even your own.
    - canEditBets: Global permission to edit any bet
    - canEditBetsOwn: Permission to edit bets where attributedTo matches user's aliases
    
    Args:
        user_id: Cognito user ID
        bet: Bet dictionary
    
    Returns:
        Dictionary with:
        - can_edit_overall: bool - can edit overall bet fields
        - can_edit_legs: List[bool] - for parlays, list indicating which legs can be edited
    """
    user_aliases = _get_user_aliases(user_id)
    
    # Global permission takes precedence
    has_global_edit = check_feature_flag(user_id, "canEditBets")
    
    # Debug logging
    print(f"check_can_edit_bet: user_id={user_id}, has_global_edit={has_global_edit}, bet_id={bet.get('betId')}")
    
    if has_global_edit:
        # Can edit everything
        bet_type = bet.get("type", "single")
        if bet_type == "single":
            return {"can_edit_overall": True}
        else:  # parlay
            legs = bet.get("legs", [])
            return {
                "can_edit_overall": True,
                "can_edit_legs": [True] * len(legs)
            }
    
    # Check "Own" permission
    has_own_edit = check_feature_flag(user_id, "canEditBetsOwn")
    if not has_own_edit:
        # No edit permission
        bet_type = bet.get("type", "single")
        if bet_type == "single":
            return {"can_edit_overall": False}
        else:  # parlay
            legs = bet.get("legs", [])
            return {
                "can_edit_overall": False,
                "can_edit_legs": [False] * len(legs)
            }
    
    # Has "Own" permission - check attribution
    bet_type = bet.get("type", "single")
    
    if bet_type == "single":
        # For single bets, check bet's attributedTo
        can_edit = _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
        return {"can_edit_overall": can_edit}
    else:  # parlay
        # For parlays:
        # - Overall: can edit if parlay's attributedTo matches
        # - Legs: can edit each leg if that leg's attributedTo matches
        can_edit_overall = _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
        
        legs = bet.get("legs", [])
        can_edit_legs = []
        for leg in legs:
            can_edit_leg = _is_attributed_to_user(leg.get("attributedTo"), user_aliases)
            can_edit_legs.append(can_edit_leg)
        
        return {
            "can_edit_overall": can_edit_overall,
            "can_edit_legs": can_edit_legs
        }


def check_can_mark_featured(user_id: str, bet: Dict) -> bool:
    """
    Check if user can mark a bet as featured.
    
    Args:
        user_id: Cognito user ID
        bet: Bet dictionary
    
    Returns:
        True if user can mark as featured, False otherwise
    """
    # Global permission takes precedence
    if check_feature_flag(user_id, "canMarkBetFeatures"):
        return True
    
    # Check "Own" permission
    if not check_feature_flag(user_id, "canMarkBetFeaturesOwn"):
        return False
    
    # Check attribution
    user_aliases = _get_user_aliases(user_id)
    bet_type = bet.get("type", "single")
    
    if bet_type == "single":
        # For single bets, check bet's attributedTo
        return _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
    else:  # parlay
        # For parlays, check parlay's attributedTo (not legs)
        return _is_attributed_to_user(bet.get("attributedTo"), user_aliases)


def check_can_mark_win_loss(user_id: str, bet: Dict) -> Dict[str, Any]:
    """
    Check if user can mark bet/leg status as won/lost.
    Returns granular permissions for overall bet and individual legs.
    
    Permissions are required for ALL bets, even your own.
    - canMarkBetWinLoss: Global permission to mark any bet's status
    - canMarkBetWinLossOwn: Permission to mark status for bets where attributedTo matches user's aliases
    
    Args:
        user_id: Cognito user ID
        bet: Bet dictionary
    
    Returns:
        Dictionary with:
        - can_mark_overall: bool - can mark overall bet status
        - can_mark_legs: List[bool] - for parlays, list indicating which leg statuses can be marked
    """
    user_aliases = _get_user_aliases(user_id)
    
    # Global permission takes precedence
    has_global_mark = check_feature_flag(user_id, "canMarkBetWinLoss")
    
    if has_global_mark:
        # Can mark everything
        bet_type = bet.get("type", "single")
        if bet_type == "single":
            return {"can_mark_overall": True}
        else:  # parlay
            legs = bet.get("legs", [])
            return {
                "can_mark_overall": True,
                "can_mark_legs": [True] * len(legs)
            }
    
    # Check "Own" permission
    has_own_mark = check_feature_flag(user_id, "canMarkBetWinLossOwn")
    if not has_own_mark:
        # No mark permission
        bet_type = bet.get("type", "single")
        if bet_type == "single":
            return {"can_mark_overall": False}
        else:  # parlay
            legs = bet.get("legs", [])
            return {
                "can_mark_overall": False,
                "can_mark_legs": [False] * len(legs)
            }
    
    # Has "Own" permission - check attribution
    bet_type = bet.get("type", "single")
    
    if bet_type == "single":
        # For single bets, check bet's attributedTo
        can_mark = _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
        return {"can_mark_overall": can_mark}
    else:  # parlay
        # For parlays:
        # - Overall: can mark if parlay's attributedTo matches
        # - Legs: can mark each leg if that leg's attributedTo matches
        can_mark_overall = _is_attributed_to_user(bet.get("attributedTo"), user_aliases)
        
        legs = bet.get("legs", [])
        can_mark_legs = []
        for leg in legs:
            can_mark_leg = _is_attributed_to_user(leg.get("attributedTo"), user_aliases)
            can_mark_legs.append(can_mark_leg)
        
        return {
            "can_mark_overall": can_mark_overall,
            "can_mark_legs": can_mark_legs
        }

