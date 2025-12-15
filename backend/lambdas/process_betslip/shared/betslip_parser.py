"""Utilities for parsing and validating bet data from Bedrock model output."""

import json
import uuid
from typing import Any, Dict, List, Tuple

from .bet_validator import validate_single_bet, validate_parlay


class BetSlipParserError(Exception):
    """Raised when the bet slip output cannot be parsed or validated."""


def _normalize_single_bet(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and validate a single bet object."""
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

    is_valid, error = validate_single_bet(bet)
    if not is_valid:
        raise BetSlipParserError(f"Invalid single bet: {error}")

    return bet


def _normalize_parlay_bet(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and validate a parlay bet object with legs."""
    legs_in: List[Dict[str, Any]] = raw.get("legs") or []
    if not isinstance(legs_in, list):
        raise BetSlipParserError("Parlay 'legs' must be a list")

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

    is_valid, error = validate_parlay(bet)
    if not is_valid:
        raise BetSlipParserError(f"Invalid parlay bet: {error}")

    return bet


def _normalize_bet(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize a single raw bet dictionary into our internal representation."""
    bet_type = (raw.get("type") or "").lower()
    if bet_type == "single":
        return _normalize_single_bet(raw)
    if bet_type == "parlay":
        return _normalize_parlay_bet(raw)
    raise BetSlipParserError("Bet 'type' must be 'single' or 'parlay'")


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

            bet = _normalize_bet(raw_bet)
            valid_bets.append(bet)
        except BetSlipParserError as exc:
            warnings.append(f"Bet {idx} skipped: {exc}")
            continue

    return valid_bets, warnings


