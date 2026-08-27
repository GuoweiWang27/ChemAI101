CREATE TABLE IF NOT EXISTS usage_counts (
  event TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (event, day)
);

CREATE TABLE IF NOT EXISTS usage_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}'
);
