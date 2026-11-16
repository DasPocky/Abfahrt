-- Zustand je Abo für die Auslöser (#72): bereits gemeldete Störungen und Stand der gemerkten
-- Fahrt, damit nur Änderungen gemeldet werden.
ALTER TABLE push_subscriptions ADD COLUMN seen_alerts TEXT;        -- JSON-Liste von Meldungs-IDs, NULL = noch nicht erfasst
ALTER TABLE push_subscriptions ADD COLUMN trip_state TEXT NOT NULL DEFAULT '{}';
