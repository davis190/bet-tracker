"""Standardized API Gateway response helpers."""

import json
from typing import Any, Dict, Optional


def create_response(
    status_code: int,
    body: Dict[str, Any],
    headers: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Create a standardized API Gateway response.
    
    Args:
        status_code: HTTP status code
        body: Response body as a dictionary
        headers: Optional additional headers
    
    Returns:
        API Gateway response format
    """
    default_headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "https://bets.claytondavis.dev",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Credentials": "true",
    }
    
    if headers:
        default_headers.update(headers)
    
    return {
        "status_code": status_code,
        "headers": default_headers,
        "body": json.dumps(body),
    }


def success_response(data: Any, status_code: int = 200) -> Dict[str, Any]:
    """Create a success response."""
    body = {"success": True, "data": data}
    return create_response(status_code, body)


def error_response(
    message: str, status_code: int = 400, error_code: Optional[str] = None
) -> Dict[str, Any]:
    """Create an error response."""
    body = {
        "success": False,
        "error": {
            "message": message,
        },
    }
    if error_code:
        body["error"]["code"] = error_code
    
    return create_response(status_code, body)

