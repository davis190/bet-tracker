"""Cognito JWT token validation utilities."""

from typing import Dict, Optional


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
        return _check_feature_flag(user_id, flag_name)
    except Exception:
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

