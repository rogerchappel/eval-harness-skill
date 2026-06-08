#!/usr/bin/env bash
# eval-harness-skill validation script
set -e

echo "=== eval-harness-skill validation ==="
echo ""

# Check required files
echo "1. Checking required files..."
for f in README.md SKILL.md package.json tsconfig.json docs/PRD.md docs/TASKS.md docs/ORCHESTRATION.md; do
  [ -f "$f" ] && echo "   ✓ $f" || { echo "   ✗ $f missing"; exit 1; }
done
echo ""

# Check fixtures
echo "2. Checking fixture eval cases..."
count=$(ls fixtures/evals/*.yaml fixtures/evals/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$count" -ge 3 ]; then
  echo "   ✓ $count fixture eval cases"
else
  echo "   ✗ Need at least 3 fixture eval cases, found $count"
  exit 1
fi
echo ""

# Check tests exist
echo "3. Checking test files..."
if [ -d "test" ] && ls test/* > /dev/null 2>&1; then
  echo "   ✓ test/ directory has test files"
else
  echo "   ✗ No test files found in test/"
  exit 1
fi
echo ""

# TypeScript check
echo "4. TypeScript type check..."
if npx tsc --noEmit 2>&1; then
  echo "   ✓ TypeScript passes"
else
  echo "   ✗ TypeScript check failed"
  exit 1
fi
echo ""

# Run tests
echo "5. Running tests..."
if npm test; then
  echo "   ✓ Tests pass"
else
  echo "   ✗ Tests failed"
  exit 1
fi
echo ""

echo "=== Validation complete ==="
