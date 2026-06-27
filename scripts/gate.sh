#!/usr/bin/env bash
# The balanced hard-gate. Each command is timeout-wrapped and we capture the REAL
# exit code (never a pipe's). ALL must be 0. Exit 124 = HUNG (investigate, not a pass).
set +e

echo "── typecheck ─────────────────────────────────────────"
timeout 300 pnpm typecheck                       ; tc=$?
echo "── lint + arch-guards ────────────────────────────────"
timeout 180 pnpm lint                            ; ln=$?
echo "── content lint ──────────────────────────────────────"
timeout 120 pnpm lint:content                    ; lc=$?
echo "── unit tests ────────────────────────────────────────"
timeout 600 pnpm test 2>&1 | tee /tmp/mq-test.log ; tst=${PIPESTATUS[0]}
echo "── build ─────────────────────────────────────────────"
timeout 300 pnpm build                           ; bd=$?

echo ""
echo "══════════════════════════════════════════════════════"
echo "GATE: typecheck=$tc lint=$ln content=$lc test=$tst build=$bd"
echo "══════════════════════════════════════════════════════"

# Surface recorded test counts so a silent drop is visible.
grep -Eo '[0-9]+ (passed|failed|skipped)' /tmp/mq-test.log 2>/dev/null | sort | uniq -c

if [ $tc -ne 0 ] || [ $ln -ne 0 ] || [ $lc -ne 0 ] || [ $tst -ne 0 ] || [ $bd -ne 0 ]; then
  echo "GATE: RED"
  exit 1
fi
echo "GATE: GREEN"
