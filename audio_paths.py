#!/usr/bin/env python3
"""Shared audio-path helpers.

Audio files are sharded across 256 subfolders of audio/ (named "00".."ff") so no
single directory grows too large (GitHub gets unhappy past ~1000 files per folder).
The bucket is a djb2 hash of the word id, so every clip belonging to a word -- the
word's own pronunciation AND all its example-sentence clips, both languages -- lands
in the same folder.

The identical hash is mirrored in flashcards.js and vocab.js as audioShard(); if you
change it here, change it there too (and re-run migrate_audio_shards.py).

The clips themselves live in two sibling repos served via the jsDelivr CDN, split by
shard: 00-7f in thailand-audio-1, 80-ff in thailand-audio-2 (see audio_repo_dir, and
audioBaseFor() in flashcards.js / vocab.js). Within a repo, shards sit at the root.

Layout (relative to an audio repo root):
  <shard>/<id>.mp3              word, Thai
  <shard>/<id>.en.mp3          word, English
  <shard>/<id>.ex<mi>_<si>.mp3     example sentence, Thai
  <shard>/<id>.ex<mi>_<si>.en.mp3  example sentence, English
"""

import os

# The two audio repos sit next to this project, e.g. .../shared/thailand-audio-1.
_SHARED_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def shard(word_id):
    """Two-hex-digit bucket ("00".."ff") for a word id, via djb2."""
    h = 5381
    for ch in word_id:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return "%02x" % (h & 0xFF)


def word_audio_rel(word_id, en=False):
    return "%s/%s%s.mp3" % (shard(word_id), word_id, ".en" if en else "")


def example_audio_rel(word_id, mi, si, en=False):
    return "%s/%s.ex%d_%d%s.mp3" % (shard(word_id), word_id, mi, si, ".en" if en else "")


def audio_repo_dir(word_id):
    """Absolute path to the audio repo (thailand-audio-1/-2) holding this word's shard."""
    n = 1 if int(shard(word_id), 16) < 0x80 else 2
    return os.path.join(_SHARED_ROOT, "thailand-audio-%d" % n)


def word_audio_path(word_id, en=False):
    """Absolute filesystem path to write a word's audio file."""
    return os.path.join(audio_repo_dir(word_id), word_audio_rel(word_id, en=en))


def example_audio_path(word_id, mi, si, en=False):
    """Absolute filesystem path to write an example-sentence audio file."""
    return os.path.join(audio_repo_dir(word_id), example_audio_rel(word_id, mi, si, en=en))
