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

