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
    """Encode raw image bytes to a base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


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

    client = get_bedrock_client()

    prompt = build_betslip_prompt()
    image_b64 = encode_image_to_base64(image_bytes)

    # Use the converse API for multimodal bet slip analysis
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
                            'format': 'png',
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


