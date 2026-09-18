"""Bet data validation utilities."""

from typing import Dict, List, Any, Tuple, Optional
import uuid
import math


def american_to_decimal_odds(odds: float) -> float:
    """
    Convert American odds to decimal odds.
    
    Args:
        odds: American odds (e.g., -110, +200, 0)
    
    Returns:
        Decimal odds (e.g., 1.909, 3.0)
    
    Raises:
        ValueError: If odds is 0 or invalid
    """
    if odds == 0:
        raise ValueError("Odds cannot be zero")
    
    if odds > 0:
        return (odds / 100) + 1
    else:
        return (100 / abs(odds)) + 1


def decimal_to_american_odds(decimal_odds: float) -> float:
    """
    Convert decimal odds to American odds.
    
    Args:
        decimal_odds: Decimal odds (e.g., 1.909, 3.0)
    
    Returns:
        American odds (e.g., -110, +200)
    """
    if decimal_odds <= 1.0:
        raise ValueError("Decimal odds must be greater than 1.0")
    
    if decimal_odds >= 2.0:
        # Positive American odds
        return (decimal_odds - 1) * 100
    else:
        # Negative American odds
        return -100 / (decimal_odds - 1)


def reverse_calculate_equal_odds(combined_odds: float, num_legs: int) -> float:
    """
    Reverse calculate individual odds from combined odds, assuming equal odds for all legs.
    
    For a parlay with N legs, if the combined decimal odds is D, and each leg has decimal odds O:
    D = O^N
    Therefore: O = D^(1/N)
    
    Args:
        combined_odds: Combined American odds for the parlay
        num_legs: Number of legs in the parlay
    
    Returns:
        Individual American odds (assuming all legs have equal odds)
    
    Raises:
        ValueError: If combined_odds is 0 or num_legs < 2
    """
    if combined_odds == 0:
        raise ValueError("Combined odds cannot be zero")
    
    if num_legs < 2:
        raise ValueError("Number of legs must be at least 2")
    
    # Convert combined American odds to decimal
    combined_decimal = american_to_decimal_odds(combined_odds)
    
    # Calculate individual decimal odds (nth root)
    individual_decimal = combined_decimal ** (1.0 / num_legs)
    
    # Convert back to American odds
    individual_american = decimal_to_american_odds(individual_decimal)
    
    return round(individual_american, 2)


def calculate_payout_from_odds(amount: float, odds: float) -> float:
    """
    Calculate potential payout from American odds.
    
    Args:
        amount: Wagered amount
        odds: American odds (e.g., -110, +200)
    
    Returns:
        Potential payout amount
    """
    if odds == 0:
        raise ValueError("Odds cannot be zero")
    
    if odds > 0:
        # Positive odds: (odds / 100) * amount + amount
        return (odds / 100) * amount + amount
    else:
        # Negative odds: (100 / abs(odds)) * amount + amount
        return (100 / abs(odds)) * amount + amount


def calculate_parlay_payout(amount: float, legs: List[Dict[str, Any]]) -> float:
    """
    Calculate potential payout for a parlay.
    
    Args:
        amount: Wagered amount
        legs: List of bet legs, each with 'odds' field
    
    Returns:
        Potential payout amount
    """
    if len(legs) < 2:
        raise ValueError("Parlay must have at least 2 legs")
    
    # Convert American odds to decimal odds
    decimal_odds_list = []
    for leg in legs:
        odds = leg.get("odds")
        if odds is None:
            raise ValueError("Each leg must have odds")
        
        if odds == 0:
            raise ValueError("Leg odds cannot be zero")
        
        decimal_odds = american_to_decimal_odds(odds)
        decimal_odds_list.append(decimal_odds)
    
    # Multiply all decimal odds
    combined_decimal = 1.0
    for dec in decimal_odds_list:
        combined_decimal *= dec
    
    # Calculate payout
    payout = amount * combined_decimal
    return round(payout, 2)


def validate_bet_leg(leg: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate a bet leg structure.
    
    Args:
        leg: Bet leg dictionary
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_fields = ["sport", "teams", "betType", "selection", "odds"]
    
    for field in required_fields:
        if field not in leg:
            return False, f"Missing required field: {field}"
    
    if not isinstance(leg["odds"], (int, float)):
        return False, "Odds must be a number"
    
    if not isinstance(leg["sport"], str) or not leg["sport"].strip():
        return False, "Sport must be a non-empty string"
    
    if not isinstance(leg["teams"], str) or not leg["teams"].strip():
        return False, "Teams must be a non-empty string"
    
    if not isinstance(leg["selection"], str) or not leg["selection"].strip():
        return False, "Selection must be a non-empty string"
    
    return True, None


def validate_single_bet(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate a single bet structure.
    
    Args:
        data: Bet data dictionary
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    required_fields = ["type", "amount", "date", "sport", "teams", "betType", "selection", "odds"]
    
    if data.get("type") != "single":
        return False, "Type must be 'single'"
    
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    if not isinstance(data["amount"], (int, float)) or data["amount"] <= 0:
        return False, "Amount must be a positive number"
    
    if not isinstance(data["odds"], (int, float)):
        return False, "Odds must be a number"
    
    # Validate date format (YYYY-MM-DD)
    try:
        from datetime import datetime
        datetime.strptime(data["date"], "%Y-%m-%d")
    except ValueError:
        return False, "Date must be in YYYY-MM-DD format"
    
    return True, None


def validate_parlay(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate a parlay structure.
    
    Args:
        data: Parlay data dictionary
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if data.get("type") != "parlay":
        return False, "Type must be 'parlay'"
    
    required_fields = ["type", "amount", "date", "legs"]
    for field in required_fields:
        if field not in data:
            return False, f"Missing required field: {field}"
    
    if not isinstance(data["amount"], (int, float)) or data["amount"] <= 0:
        return False, "Amount must be a positive number"
    
    if not isinstance(data["legs"], list):
        return False, "Legs must be a list"
    
    if len(data["legs"]) < 2:
        return False, "Parlay must have at least 2 legs"
    
    # Validate date format
    try:
        from datetime import datetime
        datetime.strptime(data["date"], "%Y-%m-%d")
    except ValueError:
        return False, "Date must be in YYYY-MM-DD format"
    
    # Validate each leg
    for i, leg in enumerate(data["legs"]):
        is_valid, error = validate_bet_leg(leg)
        if not is_valid:
            return False, f"Leg {i+1}: {error}"
        
        # Add ID if not present
        if "id" not in leg:
            leg["id"] = str(uuid.uuid4())
    
    return True, None


def validate_bet(data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate bet data (single or parlay).
    
    Args:
        data: Bet data dictionary
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    bet_type = data.get("type")
    
    if bet_type == "single":
        return validate_single_bet(data)
    elif bet_type == "parlay":
        return validate_parlay(data)
    else:
        return False, "Type must be 'single' or 'parlay'"

