#!/usr/bin/env bash
# Collect refactoring audit metrics for ai-dial-chat.
# Usage: bash .claude/skills/refactoring-audit/scripts/collect-metrics.sh
#
# This script is the source of truth for which source files to inspect.
# Skill docs describe patterns only; audit output docs list paths from this run.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "=== REFACTORING AUDIT METRICS ==="
echo "date: $(date -u +%Y-%m-%d)"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo

section() { echo; echo "## $1"; echo; }

section "Backend services (top 20)"
wc -l apps/chat-api/src/*/*.service.ts apps/chat-api/src/*/*/*.service.ts 2>/dev/null \
  | sort -rn | head -21

section "Backend test specs (top 15)"
wc -l \
  apps/chat-api/src/*/tests/*.spec.ts \
  apps/chat-api/src/*/*/tests/*.spec.ts \
  apps/chat-api/src/files/tests/*/*.spec.ts 2>/dev/null \
  | sort -rn | head -16

section "Frontend app sources (top 25, excl tests)"
wc -l apps/chat/src/**/*.ts apps/chat/src/**/*.tsx 2>/dev/null \
  | rg -v '/tests/' | sort -rn | head -26

section "Frontend test specs (top 15)"
(wc -l apps/chat/src/**/*.spec.ts apps/chat/src/**/*.spec.tsx 2>/dev/null \
  | sort -rn | head -16) || echo "(no matches)"

section "Libs total LOC (hand-authored)"
for lib in conversation-input catalog chat-shared publish-panel scheduled-tasks share quotations chat-overlay conversation-messages conversation-panel attachment-canvas attachment-input starter-buttons source-panel sidebar deployment-creation-form conversation-stages; do
  if [ -d "libs/$lib/src" ]; then
    total=$(find "libs/$lib/src" \( -name '*.ts' -o -name '*.tsx' \) -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
    if [ -n "${total:-}" ] && [ "$total" -gt 0 ] 2>/dev/null; then
      echo "$total libs/$lib"
    fi
  fi
done 2>/dev/null | sort -rn || echo "(libs scan skipped)"

section "Lib largest files (top 20)"
find libs -path '*/chat-api-client/*' -prune -o \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null \
  | while read -r f; do wc -l "$f"; done 2>/dev/null | sort -rn | head -21 || echo "(none)"

section "Active OpenSpec changes"
ls -1 openspec/changes 2>/dev/null | rg -v '^archive$' || true

section "Recent OpenSpec archives (last 15)"
ls -1 openspec/changes/archive 2>/dev/null | tail -15

section "Anti-patterns grep"
echo -n "extends AppService: "
rg -l 'extends AppService' apps/chat-api/src 2>/dev/null | wc -l | tr -d ' ' || true
echo
echo -n "MUST stay in sync: "
rg -l 'MUST stay in sync|keep in sync' apps 2>/dev/null | wc -l | tr -d ' ' || true
echo
echo -n "ExpressResponse in files services: "
rg -l 'ExpressResponse' apps/chat-api/src/files --glob '*.service.ts' 2>/dev/null | wc -l | tr -d ' ' || true
echo

section "Structural smells — long else-if chains (>=8 per file)"
rg -c '\} else if \(' apps/chat-api/src apps/chat/src libs --glob '*.ts' --glob '*.tsx' 2>/dev/null \
  | awk -F: '$2 >= 8 { print $2 " else-if  " $1 }' | sort -rn | head -15 || true

section "Structural smells — config/registry key dispatch (def.key === …)"
rg -c 'else if \(def\.key ===|if \(def\.key ===' apps/chat-api/src apps/chat/src libs --glob '*.ts' 2>/dev/null \
  | awk -F: '$2 >= 3 { print $2 " key-branches  " $1 }' | sort -rn | head -10 || true

section "Structural smells — large switch (>=10 case lines)"
rg -c '^\s+case ' apps/chat-api/src apps/chat/src libs --glob '*.ts' --glob '*.tsx' 2>/dev/null \
  | awk -F: '$2 >= 10 { print $2 " cases  " $1 }' | sort -rn | head -10 || true

section "Structural smells — nested ternaries (same line, prod only)"
rg -c '\?[^?:;\n]*\?[^?:;\n]*:' apps/chat-api/src apps/chat/src libs --glob '*.ts' --glob '*.tsx' 2>/dev/null \
  | awk -F: '$2 >= 1 { print $2 " nested-ternary  " $1 }' | rg -v '\.spec\.' | sort -rn | head -15 || true

section "Convention violations — lib isolation (must be 0 runtime hits)"
echo -n "libs importing apps/chat or @/: "
rg -l "from ['\"]@/|from ['\"].*apps/chat" libs --glob '*.{ts,tsx}' 2>/dev/null | rg -v 'chat-api-client|\.spec\.' | wc -l | tr -d ' ' || true
echo
echo -n "libs importing server-api: "
rg -l 'server-api' libs --glob '*.{ts,tsx}' 2>/dev/null | rg -v 'chat-api-client|\.spec\.' | wc -l | tr -d ' ' || true
echo
echo -n "libs importing i18n/react-i18next: "
rg -l "react-i18next|useTranslation|/i18n/" libs --glob '*.{ts,tsx}' 2>/dev/null | rg -v '\.spec\.' | wc -l | tr -d ' ' || true
echo

section "Convention violations — imports & logging"
echo -n "relative imports with .ts/.tsx/.js extension: "
rg -l "from ['\"]\.{1,2}/.+\.(ts|tsx|js)['\"]" apps/chat-api/src apps/chat/src libs --glob '*.{ts,tsx}' 2>/dev/null | wc -l | tr -d ' ' || true
echo
echo -n "console.log (disallowed): "
rg -l 'console\.log\(' apps/chat-api/src apps/chat/src libs --glob '*.{ts,tsx}' 2>/dev/null | rg -v '\.spec\.' | wc -l | tr -d ' ' || true
echo
echo -n "direct fetch in app components/hooks: "
rg -l '\bfetch\(' apps/chat/src/components apps/chat/src/hooks --glob '*.{ts,tsx}' 2>/dev/null | rg -v '\.spec\.' | wc -l | tr -d ' ' || true
echo

section "Convention violations — RTL physical Tailwind (tsx, excl specs)"
rg -n '\b(ml-|mr-|pl-|pr-|text-left|text-right|border-l-|border-r-|rounded-l-|rounded-r-)[0-9]' \
  apps/chat/src libs --glob '*.tsx' 2>/dev/null | rg -v '\.spec\.tsx' | head -10 || echo "(none)"

section "Convention violations — exported string-literal unions (prefer enums)"
rg -n "^export type \w+ = '[^']+' \|" apps/chat/src libs --glob '*.ts' 2>/dev/null \
  | rg -v '\.spec\.' | head -10 || echo "(none)"

section "Dead-code tooling readiness"
if rg -q '"noUnusedLocals"\s*:\s*true' tsconfig*.json 2>/dev/null; then
  echo "TypeScript noUnusedLocals: enabled"
else
  echo "TypeScript noUnusedLocals: NOT FOUND"
fi

if [ -x node_modules/.bin/knip ]; then
  echo "Knip: available locally"
else
  echo "Knip: unavailable (dead-code coverage will be Partial)"
fi

if [ -f .claude/skills/refactoring-audit/knip-audit.json ]; then
  echo "Knip audit config: present"
else
  echo "Knip audit config: MISSING"
fi

section "Local refactor docs git status"
for f in refactoring.md refactoring-backend.md refactoring-frontend.md; do
  if git check-ignore -q "$f" 2>/dev/null; then
    echo "IGNORED $f"
  elif git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    echo "TRACKED $f  <-- WARNING: will commit to git"
  elif [ -f "$f" ]; then
    echo "UNTRACKED $f  <-- add to .git/info/exclude"
  else
    echo "MISSING $f"
  fi
done
