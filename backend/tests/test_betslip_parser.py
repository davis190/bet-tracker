"""Basic tests for betslip_parser utilities."""

from backend.shared.betslip_parser import (  # type: ignore[import]
    BetSlipParserError,
    parse_bets_from_model_output,
)


def test_parse_valid_single_and_parlay():
    model_output = """
    {
      "bets": [
        {
          "type": "single",
          "amount": 50,
          "date": "2025-01-15",
          "sport": "NFL",
          "teams": "Team A vs Team B",
          "betType": "spread",
          "selection": "Team A -3.5",
          "odds": -110
        },
        {
          "type": "parlay",
          "amount": 25,
          "date": "2025-01-15",
          "legs": [
            {
              "sport": "NBA",
              "teams": "Lakers vs Celtics",
              "betType": "spread",
              "selection": "Lakers -4.5",
              "odds": -110
            },
            {
              "sport": "MLB",
              "teams": "Yankees vs Red Sox",
              "betType": "moneyline",
              "selection": "Yankees ML",
              "odds": -120
            }
          ]
        }
      ]
    }
    """
    bets, warnings = parse_bets_from_model_output(model_output)
    assert len(bets) == 2
    assert not warnings
    assert bets[0]["type"] == "single"
    assert bets[1]["type"] == "parlay"
    assert len(bets[1]["legs"]) == 2


def test_invalid_json_raises():
    try:
        parse_bets_from_model_output("not json")
    except BetSlipParserError:
        return
    assert False, "Expected BetSlipParserError for invalid JSON"


