#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <tag-prefix> <keep-count> [dry-run]"
  exit 1
fi

TAG_PREFIX="$1"
KEEP_COUNT="$2"
DRY_RUN="${3:-false}"

if ! printf '%s' "$KEEP_COUNT" | grep -Eq '^[0-9]+$'; then
  echo "Invalid keep count: $KEEP_COUNT"
  exit 1
fi

if [ "$KEEP_COUNT" -lt 1 ]; then
  echo "Keep count must be at least 1"
  exit 1
fi

if [ "$DRY_RUN" != "true" ] && [ "$DRY_RUN" != "false" ]; then
  echo "Dry run flag must be 'true' or 'false'"
  exit 1
fi

echo "Retention policy: keep latest $KEEP_COUNT versions for prefix '$TAG_PREFIX'"
echo "Dry run: $DRY_RUN"

git fetch --tags --force

VERSIONED_TAGS=$(
  git tag -l "${TAG_PREFIX}*" | while IFS= read -r tag; do
    version="${tag#${TAG_PREFIX}}"

    if printf '%s' "$version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
      printf '%s\t%s\n' "$version" "$tag"
    fi
  done | sort -t $'\t' -k1,1V
)

if [ -z "$VERSIONED_TAGS" ]; then
  echo "No semver tags found for prefix '$TAG_PREFIX'. Nothing to clean up."
  exit 0
fi

TOTAL_TAGS=$(printf '%s\n' "$VERSIONED_TAGS" | wc -l | tr -d ' ')

if [ "$TOTAL_TAGS" -le "$KEEP_COUNT" ]; then
  echo "Found $TOTAL_TAGS version(s); no cleanup needed."
  exit 0
fi

PRUNE_COUNT=$((TOTAL_TAGS - KEEP_COUNT))
TAGS_TO_PRUNE=$(printf '%s\n' "$VERSIONED_TAGS" | head -n "$PRUNE_COUNT" | cut -f2)

echo "Found $TOTAL_TAGS version(s). Pruning $PRUNE_COUNT old version(s)."

while IFS= read -r tag; do
  [ -z "$tag" ] && continue

  echo "Pruning $tag"

  if [ "$DRY_RUN" = "true" ]; then
    echo "[dry-run] Would delete release $tag"
    echo "[dry-run] Would delete local tag $tag"
    echo "[dry-run] Would delete remote tag $tag"
    continue
  fi

  if gh release view "$tag" > /dev/null 2>&1; then
    gh release delete "$tag" --yes
    echo "Deleted release $tag"
  else
    echo "Release $tag not found; skipping release delete"
  fi

  if git rev-parse "$tag" > /dev/null 2>&1; then
    git tag -d "$tag" > /dev/null
    echo "Deleted local tag $tag"
  else
    echo "Local tag $tag not found; skipping local tag delete"
  fi

  if git ls-remote --tags origin "refs/tags/$tag" | grep -q "refs/tags/$tag"; then
    git push origin ":refs/tags/$tag"
    echo "Deleted remote tag $tag"
  else
    echo "Remote tag $tag not found; skipping remote tag delete"
  fi
done <<< "$TAGS_TO_PRUNE"

echo "Cleanup complete for prefix '$TAG_PREFIX'."