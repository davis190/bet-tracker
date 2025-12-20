"""Amazon Bedrock (Nova) client utilities for multimodal bet slip analysis."""

import base64
import os

import boto3


def get_bedrock_client():
    """
    Get a Bedrock runtime client.

    Uses AWS_REGION from environment or defaults to us-east-1.
    """
    region = os.environ.get("AWS_REGION", "us-east-1")
    return boto3.client("bedrock-runtime", region_name=region)


def encode_image_to_base64(image_bytes: bytes) -> str:
    """
    Encode raw image bytes to a base64 string.
    
    Returns a clean base64 string with no whitespace or newlines.
    """
    if not image_bytes:
        raise ValueError("Cannot encode empty image bytes")
    
    # Validate that these look like image bytes (at least have a valid header)
    if len(image_bytes) < 4:
        raise ValueError("Image bytes are too short to be a valid image")
    
    encoded = base64.b64encode(image_bytes).decode("utf-8")
    # Remove any whitespace that might have been introduced
    return encoded.strip()


def _is_valid_base64(s: str) -> bool:
    """Check if a string is valid base64."""
    try:
        base64.b64decode(s, validate=True)
        return True
    except Exception:
        return False


def detect_image_format(image_bytes: bytes) -> str:
    """
    Detect image format from image bytes by checking magic bytes.
    
    Returns format string that matches Bedrock's expected format names:
    - 'png' for PNG images
    - 'jpeg' for JPEG images (Bedrock expects 'jpeg', not 'jpg')
    - 'gif' for GIF images
    - 'webp' for WebP images
    - 'png' as default fallback
    """
    if len(image_bytes) < 12:
        return "png"  # Default fallback
    
    # Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if image_bytes[:8] == b"\x89\x50\x4E\x47\x0D\x0A\x1A\x0A":
        return "png"
    
    # Check JPEG signature: FF D8 FF
    # Note: Bedrock expects 'jpeg' format name
    if image_bytes[:3] == b"\xFF\xD8\xFF":
        return "jpeg"
    
    # Check GIF signature: GIF87a or GIF89a
    if image_bytes[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    
    # Check WebP signature: RIFF...WEBP
    if len(image_bytes) >= 12 and image_bytes[:4] == b"RIFF" and image_bytes[8:12] == b"WEBP":
        return "webp"
    
    # Default to png if unknown
    return "png"


def build_betslip_prompt() -> str:
    """
    Build the system/user text prompt instructing the model to extract bets.

    The model MUST return only JSON in the specified format, with no extra text.
    """
    return (
        "You are a bet slip extraction assistant. You are given an image of a sports betting slip. "
        "Your task is to extract ALL bets from the slip, including single bets and parlays.\n\n"
        "Return ONLY valid JSON with this exact structure and no additional commentary:\n"
        "{\n"
        '  "bets": [\n'
        "    {\n"
        '      "type": "single",\n'
        '      "amount": <number>,\n'
        '      "date": "<YYYY-MM-DD>",\n'
        '      "sport": "<sport name or league>",\n'
        '      "teams": "<teams or participants>",\n'
        '      "betType": "spread" | "moneyline" | "over/under" | "total",\n'
        '      "selection": "<short human-readable selection>",\n'
        '      "odds": <american odds as number>,\n'
        '      "attributedTo": "<person this bet is attributed to>" | null\n'
        "    },\n"
        "    {\n"
        '      "type": "parlay",\n'
        '      "amount": <number>,\n'
        '      "date": "<YYYY-MM-DD>",\n'
        '      "legs": [\n'
        "        {\n"
        '          "sport": "<sport name or league>",\n'
        '          "teams": "<teams or participants>",\n'
        '          "betType": "spread" | "moneyline" | "over/under" | "total",\n'
        '          "selection": "<short human-readable selection>",\n'
        '          "odds": <american odds as number> | null,\n'
        '          "attributedTo": "<person this leg is attributed to>" | null,\n'
        '          "combinedOdds": <american odds as number> | null\n'
        "        }\n"
        "      ],\n"
        '      "attributedTo": "<person this parlay is attributed to overall>" | null,\n'
        '      "combinedOdds": <american odds as number> | null\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Always return an object with a top-level 'bets' array (possibly empty).\n"
        "- Use numeric types for amount and odds.\n"
        "- Use YYYY-MM-DD for date.\n"
        "- If a field is unknown, choose a reasonable best guess; do NOT omit required fields.\n"
        "- For same game parlays (multiple bets from the same game/teams combined):\n"
        "  * If individual leg odds are shown, include them in the 'odds' field for each leg.\n"
        "  * If only combined odds are shown for the same game parlay, set individual leg 'odds' to null\n"
        "    and include the combined odds in the 'combinedOdds' field at the leg level (for legs\n"
        "    in that same game parlay) or at the parlay level. All legs in a same game parlay\n"
        "    should have the same 'teams' field value.\n"
        "- Do NOT include any explanation text, only the JSON object."
    )


def analyze_betslip_image(image_bytes: bytes) -> str:
    """
    Send an image of a bet slip to Amazon Bedrock (Nova) and return the raw
    model text output (expected to be a JSON string).

    The calling code is responsible for validating and parsing this JSON.
    """
    import logging
    
    logger = logging.getLogger()
    
    model_id = os.environ.get("BEDROCK_MODEL_ID")
    if not model_id:
        raise ValueError("BEDROCK_MODEL_ID environment variable is not set")

    # Validate that we have actual image bytes
    if not image_bytes or len(image_bytes) < 12:
        raise ValueError("Invalid image data: image bytes are empty or too small")
    
    # Log image metadata for debugging
    logger.info(f"Image bytes length: {len(image_bytes)}")
    logger.info(f"First 20 bytes (hex): {image_bytes[:20].hex()}")
    logger.info(f"First 20 bytes (repr): {repr(image_bytes[:20])}")
    
    # Verify the bytes look like binary image data, not text
    # Check if the first few bytes contain valid image magic numbers
    # If it's all ASCII text, that's a problem
    first_bytes = image_bytes[:min(100, len(image_bytes))]
    is_text = all(32 <= b <= 126 or b in (9, 10, 13) for b in first_bytes[:50])
    logger.info(f"Image bytes appear to be text: {is_text}")
    
    if is_text:
        # This looks like text, not binary image data
        logger.error(f"Image bytes look like text. First 100 chars: {image_bytes[:100]}")
        raise ValueError("Image bytes appear to be text data rather than binary image data. Ensure image is properly decoded from base64.")
    
    # Detect format and validate it's a supported image format
    image_format = detect_image_format(image_bytes)
    logger.info(f"Detected image format: {image_format}")
    
    if image_format not in ['png', 'jpeg', 'gif', 'webp']:
        raise ValueError(f"Unsupported image format detected. Expected PNG, JPEG, GIF, or WebP, but format detection failed.")

    client = get_bedrock_client()

    prompt = build_betslip_prompt()
    
    # According to AWS Bedrock converse API documentation and Stack Overflow:
    # The 'bytes' field should contain RAW image bytes, not base64-encoded string
    # boto3 will handle the base64 encoding/serialization automatically when sending to the API
    logger.info(f"Preparing to call Bedrock converse API with model {model_id}, format {image_format}")
    logger.info(f"Image bytes type: {type(image_bytes)}, length: {len(image_bytes)}")
    logger.info(f"Image bytes first 20 hex: {image_bytes[:20].hex()}")
    
    try:
        # Call Bedrock converse API
        # The 'bytes' field should be raw image bytes - boto3 handles encoding
        logger.info(f"Making Bedrock converse API call with model={model_id}, format={image_format}")
        
        response = client.converse(
            modelId=model_id,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {
                            'text': prompt,
                        },
                        {
                            'image': {
                                'format': image_format,
                                'source': {
                                    'bytes': image_bytes,  # Raw bytes, not base64 string!
                                },
                            },
                        },
                    ],
                },
            ],
            inferenceConfig={
                'maxTokens': 4096,
                'temperature': 0.0,
                'topP': 0.9,
            },
        )
        logger.info("Bedrock converse API call succeeded")
    except Exception as e:
        logger.error(f"Bedrock converse API call failed: {type(e).__name__}: {str(e)}")
        logger.error(f"Request details: model={model_id}, format={image_format}, base64_len={len(image_b64)}")
        logger.error(f"Image bytes first 100 hex: {image_bytes[:100].hex()}")
        logger.error(f"Base64 first 100 chars: {image_b64[:100] if len(image_b64) >= 100 else image_b64}")
        # Log the full exception for debugging
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise

    # Extract text from converse API response
    # Response structure: output.message.content[0].text
    output = response.get('output', {})
    message = output.get('message', {})
    content = message.get('content', [])
    
    if not content:
        raise ValueError("No content in Bedrock response")
    
    # Get the first text content block
    text_content = content[0].get('text', '')
    if not text_content:
        raise ValueError("No text content in Bedrock response")
    
    return text_content


