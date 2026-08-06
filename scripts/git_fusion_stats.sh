#!/bin/bash

# Nombre de commits à analyser
COMMITS=6

git log -n $COMMITS --numstat |
awk '
{
  if (NF == 3) {
    added[$3]   += $1
    removed[$3] += $2
    total_added += $1
    total_removed += $2
  }
}
END {
  file_count = 0
  for (file in added) {
    file_count++
  }

  printf "\n%-60s %10s %10s\n", "FILE", "ADDED", "REMOVED"
  printf "%-60s %10s %10s\n", "------------------------------------------------------------", "----------", "----------"

  for (file in added) {
    printf "%-60s %+10d %+10d\n", file, added[file], removed[file]
  }

  printf "%-60s %10s %10s\n", "------------------------------------------------------------", "----------", "----------"
  printf "%-60s %+10d %+10d\n", "TOTAL LINES", total_added, total_removed
  printf "%-60s %10d\n", "TOTAL FILES", file_count
}'

