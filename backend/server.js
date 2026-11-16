/* backend/server.js — Starts MoodTrip: opens the database, builds the app, listens. */
import { config } from './src/config.js';
import { openDatabase } from './src/db.js';
import { createApp } from './src/app.js';

const db = openDatabase(config.dbFile, config.schemaFile);
createApp({ config, db }).listen(config.port, () => {
  console.log(`MoodTrip is running at http://localhost:${config.port}`);
  console.log(`  database: ${config.dbFile}`);
  console.log(`  google places: ${config.googleKey ? 'on' : 'off (no GOOGLE_PLACES_API_KEY)'}`);
});
