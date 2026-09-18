"""Utilities for parsing and validating bet data from Bedrock model output."""

import json
import uuid
from typing import Any, Dict, List, Tuple, Optional
from collections import defaultdict

from .bet_validator import validate_single_bet, validate_parlay, reverse_calculate_equal_odds


class BetSlipParserError(Exception):
    """Raised when the bet slip output cannot be parsed or validated."""


def _normalize_single_bet(raw: Dict[str, Any], validate: bool = True) -> Tuple[Dict[str, Any], Optional[str]]:
    """Normalize a single bet object, optionally validating it.
    
    Returns:
        Tuple of (bet_dict, error_message). error_message is None if valid or validate=False.
    """
    bet: Dict[str, Any] = {
        "type": "single",
        "amount": raw.get("amount"),
        "date": raw.get("date"),
        "sport": raw.get("sport"),
        "teams": raw.get("teams"),
        "betType": raw.get("betType"),
        "selection": raw.get("selection"),
        "odds": raw.get("odds"),
        # Default status to pending; attributedTo is optional
        "status": raw.get("status", "pending"),
    }

    attributed_to = raw.get("attributedTo")
    if attributed_to:
        bet["attributedTo"] = attributed_to

    if validate:
        is_valid, error = validate_single_bet(bet)
        if not is_valid:
            return bet, error
    return bet, None


def _handle_same_game_parlay_odds(legs: List[Dict[str, Any]], combined_odds: Optional[float]) -> List[Dict[str, Any]]:
    """
    Handle same game parlay odds by reverse calculating individual odds from combined odds.
    
    Groups legs by teams (same game) and calculates individual odds for legs with missing odds.
    
    Args:
        legs: List of leg dictionaries, some may have None/null odds
        combined_odds: Combined odds for same game parlay legs at parlay level (if available)
    
    Returns:
        List of legs with odds filled in where missing
    """
    # Group legs by teams (same game)
    same_game_groups: Dict[str, List[int]] = defaultdict(list)
    
    for idx, leg in enumerate(legs):
        teams = leg.get("teams", "")
        if teams:  # Only group if teams field is present
            same_game_groups[teams].append(idx)
    
    # Process each same game group
    for teams, indices in same_game_groups.items():
        if len(indices) < 2:
            continue  # Not a same game parlay if only one leg
        
        # Get odds values for all legs in this group
        leg_odds_values = []
        for idx in indices:
            odds = legs[idx].get("odds")
            if odds is not None and odds != 0:
                leg_odds_values.append((idx, odds))
        
        # Check which legs have missing/null/zero odds
        missing_odds_indices = [
            idx for idx in indices 
            if legs[idx].get("odds") is None or legs[idx].get("odds") == 0
        ]
        
        # Try to find combined odds for this group
        group_combined_odds = None
        should_recalculate = False
        
        # Case 1: Check if any leg in this group has combinedOdds field
        for idx in indices:
            leg = legs[idx]
            group_combined_odds = (
                leg.get("combinedOdds") or 
                leg.get("sameGameParlayOdds") or
                group_combined_odds
            )
            if group_combined_odds is not None:
                break
        
        # Case 2: If all legs have the same odds value, treat it as combined odds
        # This handles cases where the model extracts the combined odds as individual odds
        if group_combined_odds is None and len(leg_odds_values) == len(indices):
            # Check if all legs have the exact same odds value
            odds_values = [odds for _, odds in leg_odds_values]
            if len(set(odds_values)) == 1:
                # All legs have the same odds - this is likely the combined odds
                group_combined_odds = odds_values[0]
                should_recalculate = True
        
        # Case 3: Use parlay-level combined odds if available
        if group_combined_odds is None and combined_odds is not None and combined_odds != 0:
            # Use parlay-level combined odds if all legs in this group are missing odds
            if len(missing_odds_indices) == len(indices):
                group_combined_odds = combined_odds
                should_recalculate = True
        
        # Calculate and assign individual odds if we found combined odds
        if group_combined_odds is not None and group_combined_odds != 0:
            try:
                # Calculate individual odds for all legs in the same game parlay
                individual_odds = reverse_calculate_equal_odds(group_combined_odds, len(indices))
                
                if should_recalculate:
                    # Replace odds for all legs in the group (they all had the combined odds)
                    for idx in indices:
                        legs[idx]["odds"] = individual_odds
                else:
                    # Only apply to legs that are missing odds
                    for idx in missing_odds_indices:
                        legs[idx]["odds"] = individual_odds
            except (ValueError, ZeroDivisionError):
                # If calculation fails, we'll let validation catch it later
                pass
    
    return legs


def _normalize_parlay_bet(raw: Dict[str, Any], validate: bool = True) -> Tuple[Dict[str, Any], Optional[str]]:
    """Normalize a parlay bet object with legs, optionally validating it.
    
    Returns:
        Tuple of (bet_dict, error_message). error_message is None if valid or validate=False.
    """
    legs_in: List[Dict[str, Any]] = raw.get("legs") or []
    if not isinstance(legs_in, list):
        if validate:
            raise BetSlipParserError("Parlay 'legs' must be a list")
        else:
            # Return partial bet even if legs is not a list
            bet: Dict[str, Any] = {
                "type": "parlay",
                "amount": raw.get("amount"),
                "date": raw.get("date"),
                "legs": [],
                "status": raw.get("status", "pending"),
            }
            attributed_to = raw.get("attributedTo")
            if attributed_to:
                bet["attributedTo"] = attributed_to
            return bet, "Parlay 'legs' must be a list"

    legs: List[Dict[str, Any]] = []
    for leg in legs_in:
        # Each leg requires an id for our internal representation
        leg_copy = {
            "id": leg.get("id") or str(uuid.uuid4()),
            "sport": leg.get("sport"),
            "teams": leg.get("teams"),
            "betType": leg.get("betType"),
            "selection": leg.get("selection"),
            "odds": leg.get("odds"),
        }
        attributed_to = leg.get("attributedTo")
        if attributed_to:
            leg_copy["attributedTo"] = attributed_to
        legs.append(leg_copy)

    # Check for same game parlay combined odds at the parlay level
    combined_odds = (
        raw.get("combinedOdds") or 
        raw.get("sameGameParlayOdds") or
        raw.get("parlayOdds")
    )
    
    # Handle same game parlay odds calculation
    legs = _handle_same_game_parlay_odds(legs, combined_odds)

    bet: Dict[str, Any] = {
        "type": "parlay",
        "amount": raw.get("amount"),
        "date": raw.get("date"),
        "legs": legs,
        "status": raw.get("status", "pending"),
    }

    attributed_to = raw.get("attributedTo")
    if attributed_to:
        bet["attributedTo"] = attributed_to

    if validate:
        is_valid, error = validate_parlay(bet)
        if not is_valid:
            return bet, error
    return bet, None


def _normalize_bet(raw: Dict[str, Any], validate: bool = True) -> Tuple[Dict[str, Any], Optional[str]]:
    """Normalize a single raw bet dictionary into our internal representation.
    
    Returns:
        Tuple of (bet_dict, error_message). error_message is None if valid or validate=False.
    """
    bet_type = (raw.get("type") or "").lower()
    if bet_type == "single":
        return _normalize_single_bet(raw, validate)
    if bet_type == "parlay":
        return _normalize_parlay_bet(raw, validate)
    if validate:
        raise BetSlipParserError("Bet 'type' must be 'single' or 'parlay'")
    else:
        # Return a partial bet with error
        return {"type": bet_type or "unknown", **raw}, "Bet 'type' must be 'single' or 'parlay'"


def parse_bets_from_model_output(
    model_output: str,
    max_bets: int = 20,
    max_legs_per_parlay: int = 20,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parse and validate bets from a Bedrock model output string.

    Returns a tuple of (valid_bets, warnings).
    Raises BetSlipParserError if the JSON is malformed or completely unusable.
    """
    try:
        data = json.loads(model_output)
    except json.JSONDecodeError as exc:
        raise BetSlipParserError(f"Model output is not valid JSON: {exc}") from exc

    if not isinstance(data, dict):
        raise BetSlipParserError("Model output must be a JSON object")

    bets_raw = data.get("bets")
    if bets_raw is None:
        raise BetSlipParserError("Model output must contain a 'bets' array")
    if not isinstance(bets_raw, list):
        raise BetSlipParserError("'bets' must be a list")

    warnings: List[str] = []
    valid_bets: List[Dict[str, Any]] = []

    if len(bets_raw) > max_bets:
        warnings.append(
            f"Model returned {len(bets_raw)} bets, but only the first {max_bets} will be used."
        )
        bets_iter = bets_raw[:max_bets]
    else:
        bets_iter = bets_raw

    for idx, raw_bet in enumerate(bets_iter, start=1):
        try:
            if isinstance(raw_bet, dict) and raw_bet.get("type") == "parlay":
                # Enforce max legs per parlay
                legs = raw_bet.get("legs") or []
                if isinstance(legs, list) and len(legs) > max_legs_per_parlay:
                    warnings.append(
                        f"Bet {idx}: parlay has {len(legs)} legs; only first {max_legs_per_parlay} will be used."
                    )
                    raw_bet = dict(raw_bet)
                    raw_bet["legs"] = legs[:max_legs_per_parlay]

            # Try to normalize without validation first to get partial data
            bet, validation_error = _normalize_bet(raw_bet, validate=False)
            
            # Add validation error to bet if present
            if validation_error:
                bet["_validationError"] = validation_error
                warnings.append(f"Bet {idx} has validation errors: {validation_error}")
            
            valid_bets.append(bet)
        except BetSlipParserError as exc:
            # If normalization itself fails (e.g., JSON structure issues), still try to return partial data
            if isinstance(raw_bet, dict):
                partial_bet = dict(raw_bet)
                partial_bet["_validationError"] = str(exc)
                valid_bets.append(partial_bet)
                warnings.append(f"Bet {idx} has parsing errors: {exc}")
            else:
                warnings.append(f"Bet {idx} skipped: {exc}")
            continue

    return valid_bets, warnings


