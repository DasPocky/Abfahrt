-- Verwaltung: Einstellungen, die ohne Deploy änderbar sind (Hinweis-Banner, Tagesgrenze der
-- Sprachsuche). Fehlt ein Eintrag, gilt der Wert aus wrangler.jsonc bzw. kein Banner.
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
