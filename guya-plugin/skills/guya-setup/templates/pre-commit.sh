#!/usr/bin/env bash

# Guya Git Pre-Commit Hook — Quality Checks
#
# Runs AFTER staging (accurate file state, no TOCTOU).
# Checks: test existence, complexity, cleanup scan.
# Reads config from .guya/pre-commit-config.json.
# Humans bypass with: git commit --no-verify

set -euo pipefail

CONFIG_FILE=".guya/pre-commit-config.json"
ERRORS=()

# --- Config loading ---

if [ ! -f "$CONFIG_FILE" ]; then
  exit 0  # No config = no checks
fi

# Read config values using python (available everywhere, handles JSON properly)
read_config() {
  python3 -c "
import json, sys
with open('$CONFIG_FILE') as f:
    c = json.load(f)
# Navigate dotted path
val = c
for key in '$1'.split('.'):
    if isinstance(val, dict):
        val = val.get(key, '$2')
    else:
        val = '$2'
        break
if isinstance(val, list):
    print('\n'.join(str(v) for v in val))
else:
    print(val)
" 2>/dev/null || echo "$2"
}

# --- Skip merge/rebase ---

SKIP_MERGE=$(read_config "skipOnMerge" "true")
if [ "$SKIP_MERGE" = "True" ] || [ "$SKIP_MERGE" = "true" ]; then
  if [ -f .git/MERGE_HEAD ] || [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    exit 0
  fi
fi

# --- Get staged files ---

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)
if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# --- Helpers ---

is_exempt_path() {
  local file="$1"
  local exempt_paths
  exempt_paths=$(read_config "pathExempt" "")
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    if [[ "$file" == *"$pattern"* ]]; then
      return 0
    fi
  done <<< "$exempt_paths"
  return 1
}

is_exempt_extension() {
  local file="$1"
  local ext=".${file##*.}"
  local exempt_exts
  exempt_exts=$(read_config "reviewExempt" "")
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # Convert glob *.ext to just .ext for comparison
    local pat_ext="${pattern#\*}"
    if [ "$ext" = "$pat_ext" ]; then
      return 0
    fi
  done <<< "$exempt_exts"
  return 1
}

needs_tests() {
  local file="$1"
  local ext=".${file##*.}"
  local test_exts
  test_exts=$(read_config "testRequired.extensions" "")
  while IFS= read -r test_ext; do
    [ -z "$test_ext" ] && continue
    if [ "$ext" = "$test_ext" ]; then
      return 0
    fi
  done <<< "$test_exts"
  return 1
}

is_test_excluded() {
  local file="$1"
  local base
  base=$(basename "$file")
  local excludes
  excludes=$(read_config "testRequired.exclude" "")
  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # Simple glob: __init__.py, conftest.py, fixture*.py, *.config.py
    case "$base" in
      $pattern) return 0 ;;
    esac
  done <<< "$excludes"
  return 1
}

is_code_file() {
  local file="$1"
  local ext=".${file##*.}"
  case "$ext" in
    .py|.ts|.js|.mjs|.jsx|.tsx) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Check 1: Test file existence ---

MAX_LOC=$(read_config "complexity.maxFileLOC" "800")
MAX_FUNC=$(read_config "complexity.maxFunctionLines" "80")

check_tests() {
  local file="$1"

  # Skip non-testable files
  if ! needs_tests "$file"; then return; fi
  if is_exempt_path "$file"; then return; fi
  if is_test_excluded "$file"; then return; fi

  # Skip test files themselves
  local base
  base=$(basename "$file")
  case "$base" in
    test_*|*_test.py|*_test.ts|*_test.js) return ;;
  esac

  local name_no_ext="${base%.*}"
  local dir
  dir=$(dirname "$file")

  # Strip top-level package prefix: sdf/runtime/foo.py → runtime/foo.py
  local stripped=""
  local parts
  IFS='/' read -ra parts <<< "$dir"
  if [ ${#parts[@]} -gt 1 ]; then
    stripped=$(IFS='/'; echo "${parts[*]:1}")
  fi

  # Read test patterns from config
  local patterns
  patterns=$(read_config "testRequired.patterns" "")
  local found=false

  while IFS= read -r pattern; do
    [ -z "$pattern" ] && continue
    # Substitute {base}, {dir}, {stripped}
    local test_path="$pattern"
    test_path="${test_path//\{base\}/$name_no_ext}"
    test_path="${test_path//\{dir\}/$dir}"
    test_path="${test_path//\{stripped\}/$stripped}"

    if [ -f "$test_path" ]; then
      found=true
      break
    fi
  done <<< "$patterns"

  if [ "$found" = false ]; then
    ERRORS+=("[tests] $file — no test file found")
  fi
}

# --- Check 2: Complexity ---

check_complexity() {
  local file="$1"
  if ! is_code_file "$file"; then return; fi
  if [ ! -f "$file" ]; then return; fi

  local loc
  loc=$(wc -l < "$file" | tr -d ' ')

  if [ "$loc" -gt "$MAX_LOC" ]; then
    ERRORS+=("[complexity] $file — $loc LOC (max $MAX_LOC)")
  fi

  # Function length check (Python)
  if [[ "$file" == *.py ]]; then
    python3 -c "
import re, sys
lines = open('$file').readlines()
func_start, func_name = -1, ''
max_lines = $MAX_FUNC
for i, line in enumerate(lines):
    m = re.match(r'^\s*(?:def|async def)\s+(\w+)', line)
    if m:
        if func_start >= 0 and (i - func_start) > max_lines:
            print(f'[complexity] $file:{func_start+1} — function \"{func_name}\" is {i - func_start} lines (max {max_lines})')
        func_start, func_name = i, m.group(1)
if func_start >= 0 and (len(lines) - func_start) > max_lines:
    print(f'[complexity] $file:{func_start+1} — function \"{func_name}\" is {len(lines) - func_start} lines (max {max_lines})')
" 2>/dev/null | while IFS= read -r line; do
      ERRORS+=("$line")
    done
  fi
}

# --- Check 3: Cleanup scan ---

check_cleanup() {
  local file="$1"
  if ! is_code_file "$file"; then return; fi
  if [ ! -f "$file" ]; then return; fi

  local patterns_key="cleanup.patterns.python"
  if [[ "$file" == *.ts ]] || [[ "$file" == *.js ]] || [[ "$file" == *.mjs ]]; then
    patterns_key="cleanup.patterns.javascript"
  fi

  # Use grep for speed
  local line_num
  while IFS=: read -r line_num content; do
    [ -z "$line_num" ] && continue
    ERRORS+=("[cleanup] $file:$line_num — ${content:0:80}")
  done < <(grep -n -E '\bHACK\b|\bFIXME\b|\bdebugger\b|\bbreakpoint\(\)|\bpdb\.set_trace\b' "$file" 2>/dev/null || true)
}

# --- Run all checks ---

while IFS= read -r file; do
  [ -z "$file" ] && continue
  check_tests "$file"
  check_complexity "$file"
  check_cleanup "$file"
done <<< "$STAGED_FILES"

# --- Report ---

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "Pre-commit quality checks failed:" >&2
  echo "" >&2
  for err in "${ERRORS[@]}"; do
    echo "  $err" >&2
  done
  echo "" >&2
  echo "Fix these issues or use --no-verify to bypass." >&2
  exit 1
fi

exit 0
