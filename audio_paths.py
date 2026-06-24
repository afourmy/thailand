#!/usr/bin/env python3
"""Shared audio-path helpers.

Audio files are sharded across 256 subfolders of audio/ (named "00".."ff") so no
single directory grows too large (GitHub gets unhappy past ~1000 files per folder).
The bucket is a djb2 hash of the word id, so every clip belonging to a word -- the
word's own pronunciation AND all its example-sentence clips, both languages -- lands
in the same folder.

The identical hash is mirrored in flashcards.js and vocab.js as audioShard(); if you
change it here, change it there too (and re-run migrate_audio_shards.py).

Layout:
  audio/<shard>/<id>.mp3              word, Thai
  audio/<shard>/<id>.en.mp3          word, English
  audio/<shard>/<id>.ex<mi>_<si>.mp3     example sentence, Thai
  audio/<shard>/<id>.ex<mi>_<si>.en.mp3  example sentence, English
"""


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
