#!/usr/bin/env bash
# Deterministic contract test for fds-apply.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL_DIR="$ROOT_DIR/skills/fds-apply"
SKILL="$SKILL_DIR/SKILL.md"
SEARCH_INDEX="$SKILL_DIR/references/fds-token-search.jsonl"
QUERY="$SKILL_DIR/scripts/query_tokens.sh"

if [[ -n "${PYTHON_BIN:-}" ]]; then
    :
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1; then
    PYTHON_BIN=python3
elif command -v python >/dev/null 2>&1 && python -c 'import sys' >/dev/null 2>&1; then
    PYTHON_BIN=python
else
    echo "Python 3 is required for the FDS Token Skill contract" >&2
    exit 1
fi

for file in \
    "$SKILL" \
    "$SKILL_DIR/agents/openai.yaml" \
    "$SEARCH_INDEX" \
    "$QUERY" \
    "$SKILL_DIR/references/layer-boundaries.md" \
    "$SKILL_DIR/references/css-usage.md"
do
    [[ -f "$file" ]] || { echo "Missing required Skill file: $file" >&2; exit 1; }
done

"$PYTHON_BIN" - "$SKILL_DIR" "$SEARCH_INDEX" "$QUERY" <<'PY'
import json
import re
import sys
from pathlib import Path

skill_dir = Path(sys.argv[1])
search_index_path = Path(sys.argv[2])
query_path = Path(sys.argv[3])
skill_text = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
match = re.match(r"^---\n(.*?)\n---\n", skill_text, re.S)
assert match, "SKILL.md 缺少首行 YAML frontmatter"
keys = [line.split(":", 1)[0] for line in match.group(1).splitlines() if ":" in line]
assert keys == ["name", "description"], f"frontmatter 只能包含 name/description，实际为 {keys}"
assert "name: fds-apply" in match.group(0), "Skill name 与目录名不一致"
assert "TODO" not in skill_text and "EXAMPLE" not in skill_text, "Skill 含未清理占位符"
for heading in ("Goal", "When to Use", "ToolsList", "Workflow", "Resources", "Output"):
    assert re.search(rf"^## .*{re.escape(heading)}", skill_text, re.M), f"缺少 {heading} 章节"
assert "Fxiaoke Design System Tokens" in skill_text
assert "ShareDev" not in skill_text and "sharedev" not in skill_text.casefold()
assert "YAML" not in skill_text and "sourceFile" not in skill_text

search_records = [json.loads(line) for line in search_index_path.read_text(encoding="utf-8").splitlines()]
required = {
    "name", "cssVariable", "layer", "tier", "category", "type",
    "value", "resolvedValue", "referenceChain", "cssExample", "searchTerms",
}
assert search_records
assert all(required <= record.keys() for record in search_records)
assert all(
    field not in record
    for record in search_records
    for field in ("source", "sourceFile", "origin")
)
assert search_records[0]["layer"] == "semantic" and search_records[0]["tier"] == "base"

query_text = query_path.read_text(encoding="utf-8")
assert "query_tokens.py" not in skill_text
assert not re.search(r"(?m)^\s*(grep|rg|sed|awk|jq|python\d*|node|perl|ruby)\b", query_text)
assert "$(" not in query_text
PY

"$PYTHON_BIN" -m unittest discover \
    -s "$ROOT_DIR/tests" \
    -p 'test_query_tokens.py'

echo 'fds-apply Skill contract passed'
