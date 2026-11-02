-- MoodTrip database. Safe to run again: every statement is IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS docs (
  coll    TEXT    NOT NULL,           -- feelings | cards | reviews | trip
  id      TEXT    NOT NULL,           -- the traveler's public id (32 hex characters)
  data    TEXT    NOT NULL,           -- the document as JSON
  updated INTEGER NOT NULL,           -- milliseconds since 1970
  PRIMARY KEY (coll, id)
);
CREATE INDEX IF NOT EXISTS docs_by_time ON docs (coll, updated DESC);

CREATE TABLE IF NOT EXISTS owners (   -- who may change a traveler's documents: a hash of their secret, never the secret
  id      TEXT PRIMARY KEY,
  hash    TEXT    NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS hits (     -- write counts per visitor and minute, for rate limiting
  k      TEXT    NOT NULL,
  bucket INTEGER NOT NULL,
  n      INTEGER NOT NULL,
  PRIMARY KEY (k, bucket)
);
