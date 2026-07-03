#!/usr/bin/env python3
# Shared output-scrubbing helpers for the SDLC pipeline.
#
# Centralises SECRET_PATTERNS and sanitisation logic so that any pattern
# update takes effect in both the inline-comment gate (publish-inline-comments.py)
# and the sticky-comment gate (scrub-output.py) simultaneously.

import math
import os
import re
import urllib.parse
from collections import Counter


SECRET_PATTERNS = {
    "anthropic-key": r"sk-ant-[A-Za-z0-9_\-]{20,}",
    "openai-style-key": r"\bsk-[A-Za-z0-9]{32,}\b",
    "aws-access-key": r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
    "github-token": r"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
    "github-fine-pat": r"\bgithub_pat_[A-Za-z0-9_]{60,}\b",
    "slack-token": r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b",
    "jwt": r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b",
    "private-key-block": r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----",
}


def shannon(value):
    length = len(value)
    if length == 0:
        return 0.0
    return -sum((count / length) * math.log2(count / length) for count in Counter(value).values())


def secret_hits(body):
    """Return sorted list of secret-pattern names matched in body (empty = clean)."""
    hits = [name for name, pattern in SECRET_PATTERNS.items() if re.search(pattern, body)]
    if os.environ.get("HIGH_ENTROPY_SCAN", "true") != "false":
        for token in re.findall(r"[A-Za-z0-9+/=_\-]{32,}", body):
            if re.fullmatch(r"[0-9a-fA-F]{32,64}", token) or token.isdigit():
                continue
            if (
                any(char.isupper() for char in token)
                and any(char.islower() for char in token)
                and any(char.isdigit() for char in token)
                and shannon(token) >= 4.0
            ):
                hits.append("high-entropy-token")
                break
    return sorted(set(hits))


def neutralize_html_links(body):
    """Strip outbound-exfil vectors: images, non-allowlisted links, dangerous HTML tags."""
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    allow_hosts = {urllib.parse.urlparse(server).netloc.lower(), "github.com"}

    def host_allowed(url):
        try:
            host = urllib.parse.urlparse(url.strip()).netloc.lower()
        except ValueError:
            return False
        return bool(host) and any(host == allowed or host.endswith("." + allowed) for allowed in allow_hosts)

    body = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"[image removed by output filter: \1]", body)

    def link_repl(match):
        text, url = match.group(1), match.group(2)
        return match.group(0) if host_allowed(url) else f"{text} (link removed by output filter)"

    body = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", link_repl, body)
    body = re.sub(r"<https?://[^>]*>", "(link removed by output filter)", body, flags=re.I)
    dangerous_tags = "img|a|script|iframe|object|embed|link|video|audio|source|svg|base|form|meta|style"
    body = re.sub(rf"</?(?:{dangerous_tags})\b[^>]*>", "", body, flags=re.I)
    return body


def neutralize_public_body(body):
    """Fail-closed gate: secret scan then URL/HTML neutralize.

    Returns (scrubbed_body, None) on pass, or (None, reason_str) on block.
    """
    hits = secret_hits(body)
    if hits:
        return None, f"secret-like content blocked: {', '.join(hits)}"
    return neutralize_html_links(body), None
