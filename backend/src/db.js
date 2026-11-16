/* backend/src/db.js — Opens the SQLite file and makes sure the tables from db/schema.sql exist. Uses Node's built-in SQLite (no package to install). */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(file, schemaFile) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(readFileSync(schemaFile, 'utf8'));          // every statement is IF NOT EXISTS, so this is safe on each start
  return db;
}
