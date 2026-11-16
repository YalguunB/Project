/* backend/src/repositories/accounts.js — Every SQL statement for accounts (username + password hash) and signed-in sessions (token hash). */
export function accountsRepo(db) {
  const q = {
    account:  db.prepare('SELECT display, id, salt, hash FROM accounts WHERE name = ?'),
    taken:    db.prepare('SELECT 1 AS x FROM accounts WHERE name = ?'),
    create:   db.prepare('INSERT OR IGNORE INTO accounts (name, display, id, salt, hash, created) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id = ?)'),
    addSess:  db.prepare('INSERT INTO sessions (hash, id, name, expires) VALUES (?, ?, ?, ?)'),
    session:  db.prepare('SELECT id, name, expires FROM sessions WHERE hash = ?'),
    delSess:  db.prepare('DELETE FROM sessions WHERE hash = ?'),
    sweep:    db.prepare('DELETE FROM sessions WHERE expires < ?')
  };
  return {
    account:       name => q.account.get(name) || null,
    nameTaken:     name => !!q.taken.get(name),
    create:        (name, display, id, salt, hash) => q.create.run(name, display, id, salt, hash, Date.now(), id).changes > 0,
    addSession:    (hash, id, name, expires) => { q.addSess.run(hash, id, name, expires); },
    session:       hash => q.session.get(hash) || null,
    removeSession: hash => { q.delSess.run(hash); },
    sweepSessions: () => { q.sweep.run(Date.now()); }
  };
}
