CREATE TABLE IF NOT EXISTS usage_legacy_counts (
  event TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (event, day)
);
