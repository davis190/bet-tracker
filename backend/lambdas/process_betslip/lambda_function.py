"""Lambda function to process a bet slip image and extract bets via Bedrock."""

import base64
import json
import os
import sys
from typing import Any, Dict

import boto3

# Add shared directory to path for local development
# In packaged Lambda, shared is in the same directory
shared_path = os.path.join(os.path.dirname(__file__), "..", "..", "shared")
if os.path.exists(shared_path):
    sys.path.insert(0, shared_path)

from shared.auth import get_user_id_from_event  # type: ignore
from shared.bedrock_client import analyze_betslip_image  # type: ignore
from shared.betslip_parser import (  # type: ignore
    BetSlipParserError,
    parse_bets_from_model_output,
)
from shared.responses import error_response, options_response, success_response  # type: ignore


def _get_http_method(event: Dict[str, Any]) -> str:
    return (
        event.get("httpMethod")
        or event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("requestContext", {}).get("httpMethod")
        or ""
    )


def _decode_base64_image(image_base64: str) -> bytes:
    """Decode a base64-encoded image, stripping any data URL prefix."""
    if "," in image_base64 and image_base64.strip().startswith("data:"):
        # Handle data URL prefix like "data:image/png;base64,...."
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64)


def _load_image_from_s3(bucket: str, key: str) -> bytes:
    """Load image bytes from S3."""
    s3 = boto3.client("s3")
    response = s3.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def lambda_handler(event, context):
    """Handle POST /betslip/process request."""
    # Handle OPTIONS for CORS preflight
    http_method = _get_http_method(event)
    if http_method == "OPTIONS":
        return options_response()

    try:
        # Require authentication
        user_id = get_user_id_from_event(event)
        if not user_id:
            return error_response("Unauthorized", 401, "UNAUTHORIZED")

        # Parse request body
        try:
            body = json.loads(event.get("body", "{}") or "{}")
        except json.JSONDecodeError:
            return error_response("Invalid JSON in request body", 400, "INVALID_JSON")

        image_base64 = body.get("imageBase64")
        s3_bucket = body.get("s3Bucket")
        s3_key = body.get("s3Key")

        if not image_base64 and not (s3_bucket and s3_key):
            return error_response(
                "Request must include either 'imageBase64' or 's3Bucket' and 's3Key'",
                400,
                "MISSING_IMAGE",
            )

        # Load image bytes
        if image_base64:
            try:
                image_bytes = _decode_base64_image(image_base64)
            except Exception:
                return error_response("Invalid base64 image data", 400, "INVALID_IMAGE")
        else:
            try:
                image_bytes = _load_image_from_s3(s3_bucket, s3_key)  # type: ignore[arg-type]
            except Exception as exc:
                print(f"Error loading image from S3: {exc}")
                return error_response(
                    "Could not load image from S3", 400, "IMAGE_LOAD_ERROR"
                )

        # Call Bedrock to analyze the bet slip
        try:
            raw_output = analyze_betslip_image(image_bytes)
        except Exception as exc:
            print(f"Error invoking Bedrock: {exc}")
            return error_response(
                "Failed to analyze bet slip", 502, "BEDROCK_INVOCATION_ERROR"
            )

        # Parse and validate bets from model output
        try:
            bets, warnings = parse_bets_from_model_output(raw_output)
        except BetSlipParserError as exc:
            print(f"Parser error: {exc}")
            return error_response(
                "Could not confidently parse this bet slip", 422, "PARSER_ERROR"
            )

        # Log summary (but not full content) for observability
        print(
            json.dumps(
                {
                    "message": "Processed bet slip",
                    "userId": user_id,
                    "betCount": len(bets),
                    "warningCount": len(warnings),
                }
            )
        )

        response_body: Dict[str, Any] = {
            "bets": bets,
        }
        if warnings:
            response_body["warnings"] = warnings

        return success_response(response_body, 200)

    except Exception as e:
        # Catch-all to avoid leaking stack traces to clients
        print(f"Unhandled error in process_betslip: {str(e)}")
        return error_response(
            "Internal server error while processing bet slip",
            500,
            "INTERNAL_ERROR",
        )


