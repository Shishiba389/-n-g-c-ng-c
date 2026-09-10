CREATE TABLE totals (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  spins INTEGER NOT NULL DEFAULT 0 CHECK (spins >= 0)
);
INSERT INTO totals (id, spins) VALUES (1, 0);
