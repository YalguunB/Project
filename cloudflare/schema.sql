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

CREATE TABLE IF NOT EXISTS accounts (  -- a username and password, linked to one traveler id
  name    TEXT PRIMARY KEY,           -- the username in lower case (unique, case-insensitive)
  display TEXT    NOT NULL,           -- the username as the traveler typed it
  id      TEXT    NOT NULL UNIQUE,    -- the traveler id whose documents this account owns
  salt    TEXT    NOT NULL,
  hash    TEXT    NOT NULL,           -- PBKDF2-SHA256 of the password, never the password
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (  -- a signed-in browser: a hash of its token, never the token
  hash    TEXT PRIMARY KEY,
  id      TEXT    NOT NULL,
  name    TEXT    NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_id ON sessions (id);
