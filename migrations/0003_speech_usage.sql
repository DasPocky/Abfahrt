-- Spracheingabe (#132): verbrauchte Audio-Sekunden je Tag (UTC), für die eigene Tagesgrenze.
-- Keine Inhalte, keine IP-Adressen.
CREATE TABLE IF NOT EXISTS speech_usage (
  day TEXT PRIMARY KEY,          -- JJJJ-MM-TT (UTC, wie das Kontingent von Workers AI)
  seconds REAL NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0
);
