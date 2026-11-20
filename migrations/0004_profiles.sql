-- Geräteprofil: Favoriten und Einstellungen, damit sie sich auf ein weiteres Gerät mitnehmen lassen.
-- Entsteht erst, wenn jemand „Auf anderes Gerät übertragen“ wählt. Keine Namen, keine IP-Adressen.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,           -- zufällig, 128 Bit, base64url
  data TEXT NOT NULL,            -- JSON: { favorites, settings } wie im Browser gespeichert
  created_at INTEGER NOT NULL,   -- ms seit Epoche
  updated_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL
);

-- Ein Schlüssel je Gerät, nur als SHA-256-Hash
CREATE TABLE IF NOT EXISTS profile_keys (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_keys_profile ON profile_keys(profile_id);

-- Übertragen-Codes: einmalig, 10 Minuten, nur als Hash
CREATE TABLE IF NOT EXISTS profile_transfers (
  code_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_profile_transfers_profile ON profile_transfers(profile_id);
