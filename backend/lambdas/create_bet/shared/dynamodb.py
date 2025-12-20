"""DynamoDB client and helper functions."""

import os
import uuid
from typing import Dict, List, Any, Optional
from datetime import datetime
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError


def get_dynamodb_client():
    """Get DynamoDB client."""
    return boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def get_table():
    """Get DynamoDB table."""
    table_name = os.environ.get("BETS_TABLE_NAME")
    if not table_name:
        raise ValueError("BETS_TABLE_NAME environment variable not set")
    return get_dynamodb_client().Table(table_name)


def float_to_decimal(value: Any) -> Any:
    """
    Convert float/int values to Decimal for DynamoDB storage.
    Recursively handles nested structures.
    Decimal values are left unchanged.
    """
    if isinstance(value, Decimal):
        # Already a Decimal, return as-is
        return value
    elif isinstance(value, float) or isinstance(value, int):
        return Decimal(str(value))
    elif isinstance(value, dict):
        return {k: float_to_decimal(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [float_to_decimal(item) for item in value]
    else:
        return value


def decimal_to_float(value: Any) -> Any:
    """
    Convert Decimal values back to float/int for Python usage.
    Recursively handles nested structures.
    """
    if isinstance(value, Decimal):
        # Convert to float, but preserve integers as int where possible
        float_val = float(value)
        int_val = int(float_val)
        return int_val if float_val == int_val else float_val
    elif isinstance(value, dict):
        return {k: decimal_to_float(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [decimal_to_float(item) for item in value]
    else:
        return value


def create_bet(user_id: str, bet_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new bet in DynamoDB.
    
    Args:
        user_id: User ID
        bet_data: Bet data dictionary
    
    Returns:
        Created bet item
    """
    bet_id = str(uuid.uuid4())
    table = get_table()
    
    # Calculate payout
    from .bet_validator import calculate_payout_from_odds, calculate_parlay_payout
    
    if bet_data["type"] == "single":
        potential_payout = calculate_payout_from_odds(bet_data["amount"], bet_data["odds"])
    else:  # parlay
        potential_payout = calculate_parlay_payout(bet_data["amount"], bet_data["legs"])
    
    now = datetime.utcnow().isoformat() + "Z"
    
    item = {
        "PK": f"USER#{user_id}",
        "SK": f"BET#{bet_id}",
        "betId": bet_id,
        "userId": user_id,
        "type": bet_data["type"],
        "status": bet_data.get("status", "pending"),
        "date": bet_data["date"],
        "amount": float_to_decimal(bet_data["amount"]),
        "potentialPayout": float_to_decimal(potential_payout),
        "createdAt": now,
        "updatedAt": now,
        "GSI1PK": f"STATUS#{bet_data.get('status', 'pending')}",
        "GSI1SK": f"DATE#{bet_data['date']}",
    }
    
    if bet_data["type"] == "single":
        item.update({
            "sport": bet_data["sport"],
            "teams": bet_data["teams"],
            "betType": bet_data["betType"],
            "selection": bet_data["selection"],
            "odds": float_to_decimal(bet_data["odds"]),
        })
        # Add attributedTo if present
        if "attributedTo" in bet_data and bet_data["attributedTo"]:
            item["attributedTo"] = bet_data["attributedTo"]
    else:  # parlay
        item["legs"] = float_to_decimal(bet_data["legs"])
        # Add attributedTo if present (for the whole parlay)
        if "attributedTo" in bet_data and bet_data["attributedTo"]:
            item["attributedTo"] = bet_data["attributedTo"]
    
    # Add featured flag if present (defaults to False if not provided)
    if "featured" in bet_data:
        item["featured"] = bool(bet_data["featured"])
    else:
        item["featured"] = False
    
    # Convert entire item to ensure all floats are Decimal before writing to DynamoDB
    item = float_to_decimal(item)
    
    table.put_item(Item=item)
    # Convert back to float for return value
    return decimal_to_float(item)


def get_bets_by_user(
    user_id: str,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bet_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Get bets for a user with optional filters.
    
    Args:
        user_id: User ID
        status: Optional status filter
        start_date: Optional start date filter (YYYY-MM-DD)
        end_date: Optional end date filter (YYYY-MM-DD)
        bet_type: Optional bet type filter (single/parlay)
    
    Returns:
        List of bet items
    """
    table = get_table()
    
    # Query by user
    key_condition = Key("PK").eq(f"USER#{user_id}")
    
    response = table.query(
        KeyConditionExpression=key_condition,
        FilterExpression=Attr("SK").begins_with("BET#"),
    )
    
    bets = response.get("Items", [])
    
    # Apply filters
    if status:
        bets = [b for b in bets if b.get("status") == status]
    
    if start_date:
        bets = [b for b in bets if b.get("date") >= start_date]
    
    if end_date:
        bets = [b for b in bets if b.get("date") <= end_date]
    
    if bet_type:
        bets = [b for b in bets if b.get("type") == bet_type]
    
    # Convert DynamoDB types to Python types
    converted_bets = []
    for bet in bets:
        # Remove DynamoDB keys
        bet.pop("PK", None)
        bet.pop("SK", None)
        bet.pop("GSI1PK", None)
        bet.pop("GSI1SK", None)
        # Convert Decimal to float/int
        converted_bets.append(decimal_to_float(bet))
    
    return converted_bets


def get_bet_by_id(user_id: str, bet_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific bet by ID.
    
    Args:
        user_id: User ID
        bet_id: Bet ID
    
    Returns:
        Bet item or None if not found
    """
    table = get_table()
    
    try:
        response = table.get_item(
            Key={
                "PK": f"USER#{user_id}",
                "SK": f"BET#{bet_id}",
            }
        )
        
        if "Item" not in response:
            return None
        
        bet = response["Item"]
        # Remove DynamoDB keys
        bet.pop("PK", None)
        bet.pop("SK", None)
        bet.pop("GSI1PK", None)
        bet.pop("GSI1SK", None)
        # Convert Decimal to float/int
        return decimal_to_float(bet)
    except ClientError:
        return None


def update_bet(user_id: str, bet_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update a bet.
    
    Args:
        user_id: User ID
        bet_id: Bet ID
        updates: Dictionary of fields to update
    
    Returns:
        Updated bet item or None if not found
    """
    table = get_table()
    
    # Build update expression
    update_expression_parts = []
    expression_attribute_values = {}
    expression_attribute_names = {}
    
    for key, value in updates.items():
        if key in ["PK", "SK", "betId", "userId", "createdAt"]:
            continue  # Don't allow updating these fields
        
        update_expression_parts.append(f"#{key} = :{key}")
        expression_attribute_names[f"#{key}"] = key
        # Convert float/int to Decimal for DynamoDB
        expression_attribute_values[f":{key}"] = float_to_decimal(value)
    
    if not update_expression_parts:
        # No updates to make
        return get_bet_by_id(user_id, bet_id)
    
    # Always update updatedAt
    update_expression_parts.append("#updatedAt = :updatedAt")
    expression_attribute_names["#updatedAt"] = "updatedAt"
    expression_attribute_values[":updatedAt"] = datetime.utcnow().isoformat() + "Z"
    
    # Update GSI1PK if status is being updated
    if "status" in updates:
        update_expression_parts.append("#GSI1PK = :GSI1PK")
        expression_attribute_names["#GSI1PK"] = "GSI1PK"
        expression_attribute_values[":GSI1PK"] = f"STATUS#{updates['status']}"
    
    update_expression = "SET " + ", ".join(update_expression_parts)
    
    try:
        table.update_item(
            Key={
                "PK": f"USER#{user_id}",
                "SK": f"BET#{bet_id}",
            },
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues="ALL_NEW",
        )
        
        return get_bet_by_id(user_id, bet_id)
    except ClientError:
        return None


def delete_bet(user_id: str, bet_id: str) -> bool:
    """
    Delete a bet.
    
    Args:
        user_id: User ID
        bet_id: Bet ID
    
    Returns:
        True if deleted, False if not found
    """
    table = get_table()
    
    try:
        table.delete_item(
            Key={
                "PK": f"USER#{user_id}",
                "SK": f"BET#{bet_id}",
            }
        )
        return True
    except ClientError:
        return False


def get_bets_by_week(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all bets for the current week.
    
    Args:
        user_id: User ID
    
    Returns:
        List of bet items in current week
    """
    from .week_utils import get_current_week_range
    
    week_start, week_end = get_current_week_range()
    start_date = week_start.strftime("%Y-%m-%d")
    end_date = week_end.strftime("%Y-%m-%d")
    
    return get_bets_by_user(user_id, start_date=start_date, end_date=end_date)


def get_all_bets(
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bet_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Get all bets (public view) with optional filters.
    
    Args:
        status: Optional status filter
        start_date: Optional start date filter (YYYY-MM-DD)
        end_date: Optional end date filter (YYYY-MM-DD)
        bet_type: Optional bet type filter (single/parlay)
    
    Returns:
        List of bet items
    """
    table = get_table()
    
    # Scan all bets
    # Note: For production with large datasets, consider using a GSI or pagination
    filter_expressions = [Attr("SK").begins_with("BET#")]
    
    if status:
        filter_expressions.append(Attr("status").eq(status))
    
    if bet_type:
        filter_expressions.append(Attr("type").eq(bet_type))
    
    # Combine filter expressions
    if len(filter_expressions) > 1:
        from functools import reduce
        combined_filter = reduce(lambda x, y: x & y, filter_expressions)
    else:
        combined_filter = filter_expressions[0] if filter_expressions else None
    
    if combined_filter:
        response = table.scan(FilterExpression=combined_filter)
    else:
        response = table.scan()
    
    bets = response.get("Items", [])
    
    # Handle pagination (DynamoDB scan returns max 1MB, may need pagination)
    while "LastEvaluatedKey" in response:
        if combined_filter:
            response = table.scan(
                FilterExpression=combined_filter,
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )
        else:
            response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        bets.extend(response.get("Items", []))
    
    # Apply date filters (client-side since they're not indexed)
    if start_date:
        bets = [b for b in bets if b.get("date") >= start_date]
    
    if end_date:
        bets = [b for b in bets if b.get("date") <= end_date]
    
    # Convert DynamoDB types to Python types and remove internal keys
    converted_bets = []
    for bet in bets:
        bet.pop("PK", None)
        bet.pop("SK", None)
        bet.pop("GSI1PK", None)
        bet.pop("GSI1SK", None)
        # Convert Decimal to float/int
        converted_bets.append(decimal_to_float(bet))
    
    return converted_bets


def delete_bets_by_week(user_id: str) -> int:
    """
    Delete all bets for the current week.
    
    Args:
        user_id: User ID
    
    Returns:
        Number of bets deleted
    """
    bets = get_bets_by_week(user_id)
    deleted_count = 0
    
    for bet in bets:
        bet_id = bet["betId"]
        if delete_bet(user_id, bet_id):
            deleted_count += 1
    
    return deleted_count

