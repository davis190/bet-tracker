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
        '          "odds": <american odds as number>,\n'
        '          "attributedTo": "<person this leg is attributed to>" | null\n'
        "        }\n"
        "      ],\n"
        '      "attributedTo": "<person this parlay is attributed to overall>" | null\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Always return an object with a top-level 'bets' array (possibly empty).\n"
        "- Use numeric types for amount and odds.\n"
        "- Use YYYY-MM-DD for date.\n"
        "- If a field is unknown, choose a reasonable best guess; do NOT omit required fields.\n"
        "- Do NOT include any explanation text, only the JSON object."
    )


def analyze_betslip_image(image_bytes: bytes) -> str:
    """
    Send an image of a bet slip to Amazon Bedrock (Nova) and return the raw
    model text output (expected to be a JSON string).

    The calling code is responsible for validating and parsing this JSON.
    """
    model_id = os.environ.get("BEDROCK_MODEL_ID")
    if not model_id:
        raise ValueError("BEDROCK_MODEL_ID environment variable is not set")

    # Validate that we have actual image bytes
    if not image_bytes or len(image_bytes) < 12:
        raise ValueError("Invalid image data: image bytes are empty or too small")
    
    # Verify the bytes look like binary image data, not text
    # Check if the first few bytes contain valid image magic numbers
    # If it's all ASCII text, that's a problem
    first_bytes = image_bytes[:min(100, len(image_bytes))]
    if all(32 <= b <= 126 or b in (9, 10, 13) for b in first_bytes[:50]):
        # This looks like text, not binary image data
        raise ValueError("Image bytes appear to be text data rather than binary image data. Ensure image is properly decoded from base64.")
    
    # Detect format and validate it's a supported image format
    image_format = detect_image_format(image_bytes)
    if image_format not in ['png', 'jpeg', 'gif', 'webp']:
        raise ValueError(f"Unsupported image format detected. Expected PNG, JPEG, GIF, or WebP, but format detection failed.")

    client = get_bedrock_client()

    prompt = build_betslip_prompt()
    image_b64 = encode_image_to_base64(image_bytes)

    # Use the converse API for multimodal bet slip analysis
    # The 'bytes' field expects a base64-encoded string (not raw bytes)
    # boto3 will serialize this correctly for the API call
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
                                'bytes': image_b64,
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


