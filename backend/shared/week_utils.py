"""Week calculation utilities."""

from datetime import datetime, timedelta
from typing import Tuple


def get_current_week_range() -> Tuple[datetime, datetime]:
    """
    Get the start and end dates for the current week (Monday to Sunday).
    
    Returns:
        Tuple of (week_start, week_end) as datetime objects
    """
    today = datetime.now().date()
    # Get Monday (weekday 0)
    days_since_monday = today.weekday()
    week_start = datetime.combine(today - timedelta(days=days_since_monday), datetime.min.time())
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return week_start, week_end


def is_date_in_week(date_str: str, week_start: datetime) -> bool:
    """
    Check if a date string falls within the specified week.
    
    Args:
        date_str: ISO date string (YYYY-MM-DD)
        week_start: Start of the week (Monday)
    
    Returns:
        True if date is in the week, False otherwise
    """
    try:
        bet_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        week_start_date = week_start.date()
        week_end_date = (week_start + timedelta(days=6)).date()
        return week_start_date <= bet_date <= week_end_date
    except ValueError:
        return False


def get_week_start_for_date(date_str: str) -> datetime:
    """
    Get the Monday of the week for a given date string.
    
    Args:
        date_str: ISO date string (YYYY-MM-DD)
    
    Returns:
        Monday of that week as datetime
    """
    bet_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    days_since_monday = bet_date.weekday()
    week_start = datetime.combine(bet_date - timedelta(days=days_since_monday), datetime.min.time())
    return week_start

