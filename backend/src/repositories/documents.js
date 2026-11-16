/* backend/src/repositories/documents.js — Every SQL statement for the documents, the owner hashes and the rate-limit counters. */
export function documentsRepo(db) {
  const q = {
    stat:   db.prepare('SELECT COUNT(*) AS c, COALESCE(MAX(updated), 0) AS m FROM docs WHERE coll = ?'),
    list:   db.prepare('SELECT id, data FROM docs WHERE coll = ? ORDER BY updated DESC LIMIT 500'),
    get:    db.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?'),
    has:    db.prepare('SELECT 1 AS x FROM docs WHERE coll = ? AND id = ?'),
    count:  db.prepare('SELECT COUNT(*) AS c FROM docs'),
    upsert: db.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated'),
    del:    db.prepare('DELETE FROM docs WHERE coll = ? AND id = ?'),
    owner:  db.prepare('SELECT hash FROM owners WHERE id = ?'),
    claim:  db.prepare('INSERT OR IGNORE INTO owners (id, hash, created) VALUES (?, ?, ?)'),
    hit:    db.prepare('INSERT INTO hits (k, bucket, n) VALUES (?, ?, 1) ON CONFLICT(k, bucket) DO UPDATE SET n = n + 1 RETURNING n'),
    sweep:  db.prepare('DELETE FROM hits WHERE bucket < ?')
  };
  return {
    stat:      coll => q.stat.get(coll),
    list:      coll => q.list.all(coll),
    get:       (coll, id) => q.get.get(coll, id),
    has:       (coll, id) => !!q.has.get(coll, id),
    total:     () => q.count.get().c,
    save:      (coll, id, json) => { q.upsert.run(coll, id, json, Date.now()); },
    remove:    (coll, id) => { q.del.run(coll, id); },
    ownerHash: id => { const r = q.owner.get(id); return r ? r.hash : null; },
    claim:     (id, hash) => { q.claim.run(id, hash, Date.now()); },
    hit:       (k, bucket) => q.hit.get(k, bucket).n,
    sweep:     bucket => { q.sweep.run(bucket); }
  };
}
