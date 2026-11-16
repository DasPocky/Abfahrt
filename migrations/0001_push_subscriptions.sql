-- Push-Abos (#71). Keine personenbezogenen Daten: nur der Endpunkt des Push-Dienstes und dessen
-- Schlüssel; „topics“ (JSON) beschreibt später, wofür Nachrichten kommen sollen (#72).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,          -- SHA-256 des Endpunkts (hex)
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  topics TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,  -- Unix-Zeit in ms
  updated_at INTEGER NOT NULL,
  last_success_at INTEGER,
  failures INTEGER NOT NULL DEFAULT 0
);
