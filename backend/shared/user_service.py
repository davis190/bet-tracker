"""User profile service for managing user profiles and feature flags."""

import os
from typing import Dict, Any, Optional, List
from datetime import datetime
import boto3
from botocore.exceptions import ClientError


def get_users_table():
    """Get Users DynamoDB table."""
    table_name = os.environ.get("USERS_TABLE_NAME")
    if not table_name:
        raise ValueError("USERS_TABLE_NAME environment variable not set")
    dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    return dynamodb.Table(table_name)


def get_default_feature_flags(role: str = "user") -> Dict[str, bool]:
    """
    Get default feature flags based on role.
    
    Args:
        role: User role ("user" or "admin")
    
    Returns:
        Dictionary of feature flags with default values
    """
    if role == "admin":
        return {
            "canCreateBets": True,
            "canManageBets": True,  # Kept for backward compatibility
            "canDeleteBets": True,
            "canClearWeek": True,
            "canBetslipImport": True,
            # New granular permissions
            "seeManageBetsPage": True,
            "seeManageBetsPageOwn": False,
            "canEditBets": True,
            "canEditBetsOwn": False,
            "canMarkBetFeatures": True,
            "canMarkBetFeaturesOwn": False,
            "canMarkBetWinLoss": True,
            "canMarkBetWinLossOwn": False,
        }
    else:  # user role
        return {
            "canCreateBets": True,
            "canManageBets": False,  # Kept for backward compatibility
            "canDeleteBets": False,
            "canClearWeek": False,
            "canBetslipImport": False,
            # New granular permissions (all false by default)
            "seeManageBetsPage": False,
            "seeManageBetsPageOwn": False,
            "canEditBets": False,
            "canEditBetsOwn": False,
            "canMarkBetFeatures": False,
            "canMarkBetFeaturesOwn": False,
            "canMarkBetWinLoss": False,
            "canMarkBetWinLossOwn": False,
        }


def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Get user profile from Users table.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        User profile dictionary or None if not found
    """
    table = get_users_table()
    
    try:
        response = table.get_item(
            Key={"userId": user_id}
        )
        
        if "Item" not in response:
            return None
        
        return response["Item"]
    except ClientError:
        return None


def create_user_profile(user_id: str, email: str, role: str = "user") -> Dict[str, Any]:
    """
    Create a new user profile with default feature flags.
    
    Args:
        user_id: Cognito user ID
        email: User email address
        role: User role ("user" or "admin"), defaults to "user"
    
    Returns:
        Created user profile
    """
    table = get_users_table()
    
    now = datetime.utcnow().isoformat() + "Z"
    feature_flags = get_default_feature_flags(role)
    
    profile = {
        "userId": user_id,
        "email": email,
        "role": role,
        "featureFlags": feature_flags,
        "aliases": [],  # Default to empty list
        "createdAt": now,
        "updatedAt": now,
    }
    
    table.put_item(Item=profile)
    return profile


def get_or_create_user_profile(user_id: str, email: str) -> Dict[str, Any]:
    """
    Get user profile, creating it if it doesn't exist.
    
    Args:
        user_id: Cognito user ID
        email: User email address
    
    Returns:
        User profile dictionary
    """
    profile = get_user_profile(user_id)
    if profile:
        return profile
    
    # Create default profile with "user" role
    return create_user_profile(user_id, email, role="user")


def update_user_profile(user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update user profile.
    
    Args:
        user_id: Cognito user ID
        updates: Dictionary of fields to update
    
    Returns:
        Updated user profile or None if not found
    """
    table = get_users_table()
    
    # Build update expression
    update_expression_parts = []
    expression_attribute_values = {}
    expression_attribute_names = {}
    
    for key, value in updates.items():
        if key == "userId":
            continue  # Don't allow updating userId
        
        if key == "featureFlags":
            # Handle feature flags update
            update_expression_parts.append("#featureFlags = :featureFlags")
            expression_attribute_names["#featureFlags"] = "featureFlags"
            expression_attribute_values[":featureFlags"] = value
        elif key == "aliases":
            # Handle aliases update (list of strings)
            update_expression_parts.append("#aliases = :aliases")
            expression_attribute_names["#aliases"] = "aliases"
            expression_attribute_values[":aliases"] = value
        elif key == "role":
            # When role changes, update feature flags to defaults for that role
            update_expression_parts.append("#role = :role")
            expression_attribute_names["#role"] = "role"
            expression_attribute_values[":role"] = value
            # Update feature flags based on new role
            new_flags = get_default_feature_flags(value)
            update_expression_parts.append("#featureFlags = :featureFlags")
            expression_attribute_names["#featureFlags"] = "featureFlags"
            expression_attribute_values[":featureFlags"] = new_flags
        else:
            update_expression_parts.append(f"#{key} = :{key}")
            expression_attribute_names[f"#{key}"] = key
            expression_attribute_values[f":{key}"] = value
    
    if not update_expression_parts:
        # No updates to make
        return get_user_profile(user_id)
    
    # Always update updatedAt
    update_expression_parts.append("#updatedAt = :updatedAt")
    expression_attribute_names["#updatedAt"] = "updatedAt"
    expression_attribute_values[":updatedAt"] = datetime.utcnow().isoformat() + "Z"
    
    update_expression = "SET " + ", ".join(update_expression_parts)
    
    try:
        print(f"update_user_profile: Updating DynamoDB item for user_id={user_id}")
        print(f"update_user_profile: UpdateExpression={update_expression}")
        print(f"update_user_profile: ExpressionAttributeNames={expression_attribute_names}")
        print(f"update_user_profile: ExpressionAttributeValues={expression_attribute_values}")
        
        response = table.update_item(
            Key={"userId": user_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW",
        )
        
        print(f"update_user_profile: DynamoDB update_item succeeded, response keys: {list(response.keys())}")
        
        updated_profile = get_user_profile(user_id)
        print(f"update_user_profile: Retrieved updated profile: {updated_profile is not None}")
        return updated_profile
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_message = e.response.get("Error", {}).get("Message", str(e))
        print(f"update_user_profile: DynamoDB ClientError - Code: {error_code}, Message: {error_message}")
        print(f"update_user_profile: Full error response: {e.response}")
        import traceback
        print(f"update_user_profile: Traceback: {traceback.format_exc()}")
        return None
    except Exception as e:
        print(f"update_user_profile: Unexpected exception: {type(e).__name__}: {str(e)}")
        import traceback
        print(f"update_user_profile: Traceback: {traceback.format_exc()}")
        return None


def check_feature_flag(user_id: str, flag_name: str) -> bool:
    """
    Check if user has a specific feature flag enabled.
    
    Args:
        user_id: Cognito user ID
        flag_name: Name of the feature flag to check
    
    Returns:
        True if flag is enabled, False otherwise
    """
    profile = get_user_profile(user_id)
    if not profile:
        print(f"check_feature_flag: Profile not found for user_id={user_id}")
        return False
    
    feature_flags = profile.get("featureFlags", {})
    result = feature_flags.get(flag_name, False)
    print(f"check_feature_flag: user_id={user_id}, flag_name={flag_name}, feature_flags={feature_flags}, result={result}")
    return result


def get_user_role(user_id: str) -> Optional[str]:
    """
    Get user role.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        User role ("user" or "admin") or None if not found
    """
    profile = get_user_profile(user_id)
    if not profile:
        return None
    
    return profile.get("role", "user")


def is_admin(user_id: str) -> bool:
    """
    Check if user is an admin.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        True if user is admin, False otherwise
    """
    return get_user_role(user_id) == "admin"


def get_user_aliases(user_id: str) -> List[str]:
    """
    Get user's aliases list.
    
    Args:
        user_id: Cognito user ID
    
    Returns:
        List of user aliases (empty list if not found or not set)
    """
    profile = get_user_profile(user_id)
    if not profile:
        return []
    
    aliases = profile.get("aliases", [])
    if not isinstance(aliases, list):
        return []
    
    return aliases


def list_all_users() -> List[Dict[str, Any]]:
    """
    List all users from the Users table.
    
    Returns:
        List of all user profiles
    """
    table = get_users_table()
    
    try:
        response = table.scan()
        users = response.get("Items", [])
        
        # Handle pagination (DynamoDB scan returns max 1MB, may need pagination)
        while "LastEvaluatedKey" in response:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            users.extend(response.get("Items", []))
        
        return users
    except ClientError as e:
        print(f"Error scanning users table: {str(e)}")
        return []

