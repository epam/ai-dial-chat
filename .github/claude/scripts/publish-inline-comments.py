#!/usr/bin/env python3
# Publish stage-output payload.findings[] as GitHub PR review comments when a
# finding can be anchored to a line present in the PR diff.
#
# The script annotates each finding with payload.findings[].inline_comment:
#   {eligible, posted, reason?, marker?, side?, line?}
# render-stage-comment.py uses `posted: true` to avoid duplicating the same
# finding in the sticky summary table.

import hashlib
import json
import math
import os
import re
import subprocess
import sys
import urllib.parse
from collections import Counter
from pathlib import Path


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
MESSAGE_FIELDS = ("message", "title", "description", "details", "reason", "evidence")


def notice(message):
    sys.stderr.write(f"::notice::{message}\n")


def warning(message):
    sys.stderr.write(f"::warning::{message}\n")


def run_gh(args):
    return subprocess.run(
        ["gh", "api", *args],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ).stdout


def run_gh_paginated(endpoint):
    pages = json.loads(run_gh([endpoint, "--paginate", "--slurp"]))
    if pages and all(isinstance(page, list) for page in pages):
        return [item for page in pages for item in page]
    return pages


def parse_right_lines(patch):
    if not patch:
        return set()

    right_lines = set()
    new_line = None
    for raw in patch.splitlines():
        header = re.match(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw)
        if header:
            new_line = int(header.group(1))
            continue
        if new_line is None:
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            right_lines.add(new_line)
            new_line += 1
        elif raw.startswith(" "):
            right_lines.add(new_line)
            new_line += 1
        elif raw.startswith("-") and not raw.startswith("---"):
            continue
        elif raw.startswith("\\"):
            continue
    return right_lines


def shannon(value):
    length = len(value)
    if length == 0:
        return 0.0
    return -sum((count / length) * math.log2(count / length) for count in Counter(value).values())


def secret_hits(body):
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


def neutralize_public_body(body):
    hits = secret_hits(body)
    if hits:
        return None, f"secret-like content blocked: {', '.join(hits)}"

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
    return body, None


def marker_for(stage, finding):
    basis = "\n".join(
        str(finding.get(key, ""))
        for key in ("file", "line", "severity", "message", "suggested_fix", "requirement_ref")
    )
    digest = hashlib.sha256(f"{stage}\n{basis}".encode()).hexdigest()[:16]
    return f"<!-- dial-sdlc-inline:{stage}:{digest} -->"


def finding_message(finding):
    parts = []
    for field in MESSAGE_FIELDS:
        value = finding.get(field)
        if isinstance(value, str) and value.strip():
            parts.append(value.strip())
    suggested_fix = finding.get("suggested_fix")
    if isinstance(suggested_fix, str) and suggested_fix.strip():
        parts.append(f"Suggested fix: {suggested_fix.strip()}")
    if parts:
        return "\n\n".join(parts)
    return "No finding message provided by agent."


def body_for(stage, finding, marker):
    severity = finding.get("severity", "info")
    message = finding_message(finding)
    body = f"{marker}\n**{stage} · {severity}**\n\n{message}"
    return body


def main():
    output_file = Path(os.environ.get("STAGE_OUTPUT_FILE", "stage-output.json"))
    stage = os.environ["STAGE_NAME"]
    repo = os.environ["REPO"]
    pr_number = os.environ["PR_NUMBER"]
    commit_id = os.environ["PR_HEAD_SHA"]

    doc = json.loads(output_file.read_text())
    findings = (doc.get("payload") or {}).get("findings") or []
    if not findings:
        notice("No findings to publish inline.")
        return

    files = run_gh_paginated(f"repos/{repo}/pulls/{pr_number}/files")
    right_lines_by_path = {
        item.get("filename"): parse_right_lines(item.get("patch") or "")
        for item in files
        if item.get("filename")
    }

    existing_comments = run_gh_paginated(f"repos/{repo}/pulls/{pr_number}/comments")
    existing_markers = {
        match.group(0)
        for comment in existing_comments
        if comment.get("commit_id") == commit_id
        for match in re.finditer(r"<!-- dial-sdlc-inline:[^:]+:[a-f0-9]{16} -->", comment.get("body") or "")
    }

    candidates = []
    blocked_reasons = []
    posted = skipped = 0
    for finding in findings:
        inline = {"eligible": False, "posted": False}
        finding["inline_comment"] = inline

        path = finding.get("file")
        line = finding.get("line")
        if not path or not isinstance(line, int):
            inline["reason"] = "missing file or line"
            skipped += 1
            continue

        right_lines = right_lines_by_path.get(path)
        if not right_lines:
            inline["reason"] = "file has no inline-commentable diff patch"
            skipped += 1
            continue
        if line not in right_lines:
            inline["reason"] = "line is not present in the PR diff"
            skipped += 1
            continue

        marker = marker_for(stage, finding)
        body, scrub_reason = neutralize_public_body(body_for(stage, finding, marker))
        if scrub_reason:
            inline["reason"] = scrub_reason
            blocked_reasons.append(f"{path}:{line} {scrub_reason}")
            skipped += 1
            continue

        inline.update({"eligible": True, "marker": marker, "side": "RIGHT", "line": line})
        if marker in existing_markers:
            inline["posted"] = True
            inline["reason"] = "already posted"
            posted += 1
            continue

        candidates.append((finding, path, line, body))

    if blocked_reasons:
        output_file.write_text(json.dumps(doc, indent=2))
        for reason in blocked_reasons:
            warning(reason)
        raise SystemExit(
            "::error::Inline comment publishing blocked by M4 secret scan. "
            "No new inline comments were posted."
        )

    for finding, path, line, body in candidates:
        inline = finding["inline_comment"]
        try:
            run_gh(
                [
                    "-X",
                    "POST",
                    f"repos/{repo}/pulls/{pr_number}/comments",
                    "-f",
                    f"body={body}",
                    "-f",
                    f"commit_id={commit_id}",
                    "-f",
                    f"path={path}",
                    "-F",
                    f"line={line}",
                    "-f",
                    "side=RIGHT",
                ]
            )
        except subprocess.CalledProcessError as exc:
            inline["reason"] = f"GitHub API rejected inline comment: {exc.stderr.strip()[:240]}"
            warning(f"Could not post inline comment for {path}:{line}: {exc.stderr.strip()[:240]}")
            skipped += 1
            continue

        inline["posted"] = True
        posted += 1

    output_file.write_text(json.dumps(doc, indent=2))
    notice(f"Inline comments: {posted} posted/already-present, {skipped} left for sticky summary.")


if __name__ == "__main__":
    main()
