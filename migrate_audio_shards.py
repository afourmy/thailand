#!/usr/bin/env python3
"""One-time migration: move flat audio/<file>.mp3 into the sharded layout
audio/<shard>/<file>.mp3 (see audio_paths.shard). The word id is the filename up to
the first dot. Safe to re-run: only top-level files are moved, and a file already at
its destination is skipped.

Usage:
  python3 migrate_audio_shards.py
"""
from pathlib import Path

import audio_paths

HERE = Path(__file__).resolve().parent
AUDIO = HERE / "audio"


def main():
    moved = skipped = 0
    for f in sorted(AUDIO.glob("*.mp3")):  # top level only; subfolders untouched
        word_id = f.name.split(".", 1)[0]
        dest_dir = AUDIO / audio_paths.shard(word_id)
        dest = dest_dir / f.name
        if dest.exists():
            skipped += 1
            continue
        dest_dir.mkdir(parents=True, exist_ok=True)
        f.rename(dest)
        moved += 1
    remaining = len(list(AUDIO.glob("*.mp3")))
    n_dirs = len([d for d in AUDIO.iterdir() if d.is_dir()])
    print("moved %d, skipped %d; top-level mp3 remaining: %d; shard folders: %d"
          % (moved, skipped, remaining, n_dirs))


if __name__ == "__main__":
    main()
