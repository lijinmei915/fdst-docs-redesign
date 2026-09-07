#!/usr/bin/env bash
# Query the generated FDS JSONL index using Bash built-ins only.

set -u
shopt -s nocasematch

SCRIPT_SOURCE="${BASH_SOURCE[0]//\\//}"
if [[ "$SCRIPT_SOURCE" == */* ]]; then
    SCRIPT_DIR="${SCRIPT_SOURCE%/*}"
else
    SCRIPT_DIR="."
fi

INDEX="$SCRIPT_DIR/../references/fds-token-search.jsonl"
NAME=""
SEARCH=""
LAYER=""
TIER=""
CATEGORY=""
TOKEN_TYPE=""
LIMIT=10

usage() {
    printf '%s\n' \
        'Usage: bash scripts/query_tokens.sh [options]' \
        '  --name <token-or-css-variable>' \
        '  --search <space-separated-terms>' \
        '  --layer <atomic|semantic>' \
        '  --tier <seed|map|base|scene>' \
        '  --category <category>' \
        '  --type <type>' \
        '  --limit <1-50>'
}

argument_error() {
    printf '参数错误：%s\n' "$1" >&2
    usage >&2
    exit 2
}

require_value() {
    [[ $# -ge 2 && -n "$2" ]] || argument_error "$1 缺少参数值"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --name)
            require_value "$@"
            NAME="$2"
            shift 2
            ;;
        --search)
            require_value "$@"
            SEARCH="$2"
            shift 2
            ;;
        --layer)
            require_value "$@"
            LAYER="$2"
            shift 2
            ;;
        --tier)
            require_value "$@"
            TIER="$2"
            shift 2
            ;;
        --category)
            require_value "$@"
            CATEGORY="$2"
            shift 2
            ;;
        --type)
            require_value "$@"
            TOKEN_TYPE="$2"
            shift 2
            ;;
        --limit)
            require_value "$@"
            LIMIT="$2"
            shift 2
            ;;
        --index)
            require_value "$@"
            INDEX="$2"
            shift 2
            ;;
        --json)
            shift
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            argument_error "不支持的参数 $1"
            ;;
    esac
done

[[ -z "$NAME" || -z "$SEARCH" ]] || argument_error '--name 与 --search 不能同时使用'
[[ -n "$NAME" || -n "$SEARCH" || -n "$LAYER" || -n "$TIER" || -n "$CATEGORY" || -n "$TOKEN_TYPE" ]] \
    || argument_error '至少提供 --name、--search 或一个过滤条件'
[[ "$LIMIT" =~ ^[0-9]+$ ]] && (( LIMIT >= 1 && LIMIT <= 50 )) \
    || argument_error '--limit 必须在 1 到 50 之间'

case "$LAYER" in
    ''|atomic|semantic) ;;
    *) argument_error '--layer 只接受 atomic 或 semantic' ;;
esac
case "$TIER" in
    ''|seed|map|base|scene) ;;
    *) argument_error '--tier 只接受 seed、map、base 或 scene' ;;
esac

if [[ ! -r "$INDEX" ]]; then
    printf '索引读取失败：%s\n' "$INDEX" >&2
    exit 1
fi

SEARCH_TERMS=()
if [[ -n "$SEARCH" ]]; then
    read -r -a SEARCH_TERMS <<< "$SEARCH"
    [[ ${#SEARCH_TERMS[@]} -gt 0 ]] || argument_error '--search 不能为空'
fi

matches_line() {
    local line="$1"
    local normalized_name="${NAME#--fds-g-}"
    local term

    [[ -z "$NAME" || "$line" == *"\"name\":\"$normalized_name\""* ]] || return 1
    [[ -z "$LAYER" || "$line" == *"\"layer\":\"$LAYER\""* ]] || return 1
    [[ -z "$TIER" || "$line" == *"\"tier\":\"$TIER\""* ]] || return 1
    [[ -z "$CATEGORY" || "$line" == *"\"category\":\"$CATEGORY\""* ]] || return 1
    [[ -z "$TOKEN_TYPE" || "$line" == *"\"type\":\"$TOKEN_TYPE\""* ]] || return 1

    for term in "${SEARCH_TERMS[@]}"; do
        [[ "$line" == *"$term"* ]] || return 1
    done
    return 0
}

MATCHED=0
while IFS= read -r LINE || [[ -n "$LINE" ]]; do
    if matches_line "$LINE"; then
        printf '%s\n' "$LINE"
        (( MATCHED += 1 ))
        (( MATCHED < LIMIT )) || break
    fi
done < "$INDEX"
