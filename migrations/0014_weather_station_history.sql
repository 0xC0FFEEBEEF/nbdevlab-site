CREATE TABLE IF NOT EXISTS weather_station_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  values_json TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weather_station_history_station_observed
  ON weather_station_history(station_id, observed_at);

CREATE INDEX IF NOT EXISTS idx_weather_station_history_observed
  ON weather_station_history(observed_at DESC, id DESC);
