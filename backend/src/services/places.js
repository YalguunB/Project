/* backend/src/services/places.js — Google Places proxy. The API key stays on the server; Google's content is passed through, never stored. */
const G_IMG = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.googleusercontent\.com\//i;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const who = a => ({ name: str(a && a.displayName, 120), url: str(a && a.uri, 400), avatar: str(a && a.photoUri, 500) });

export function placesService({ allowed, googleKey, placesBase }) {
  return {
    configured: !!googleKey,

    async place(id) {                                 // GET /api/place?id=
      if (!allowed.has(id)) return { status: 404, body: { error: 'unknown_place' } };
      if (!googleKey) return { status: 503, body: { error: 'not_configured' } };
      const res = await fetch(`${placesBase}/places/${id}?languageCode=en`, {
        headers: {
          'X-Goog-Api-Key': googleKey,
          // ask only for what the page shows: the price depends on the fields requested
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,googleMapsUri,regularOpeningHours.weekdayDescriptions,photos,reviews'
        }
      });
      if (!res.ok) return { status: 502, body: { error: 'upstream', status: res.status } };
      const p = await res.json();
      return {
        status: 200,
        body: {
          id,
          name: str(p.displayName && p.displayName.text, 160),
          rating: Number(p.rating) || 0,
          count: Number(p.userRatingCount) || 0,
          url: str(p.googleMapsUri, 400),
          hours: ((p.regularOpeningHours && p.regularOpeningHours.weekdayDescriptions) || []).slice(0, 7).map(h => str(h, 100)),
          photos: (p.photos || []).map(ph => ({ ref: str(ph.name, 700), w: ph.widthPx | 0, h: ph.heightPx | 0, by: who((ph.authorAttributions || [])[0]) }))
            .filter(ph => ph.ref.startsWith(`places/${id}/photos/`)).slice(0, 6),
          reviews: (p.reviews || []).slice(0, 5).map(r => ({
            rating: Number(r.rating) || 0, when: str(r.relativePublishTimeDescription, 60),
            t: str(r.text && r.text.text, 5000), tl: str(r.text && r.text.languageCode, 16),
            o: str(r.originalText && r.originalText.text, 5000), ol: str(r.originalText && r.originalText.languageCode, 16),
            by: who(r.authorAttribution), flag: str(r.flagContentUri, 500)
          }))
        }
      };
    },

    async photo(ref, width) {                         // GET /api/photo?ref=&w=  -> { redirect } or { status }
      const m = /^places\/([A-Za-z0-9_-]{20,200})\/photos\/([A-Za-z0-9_-]{10,600})$/.exec(ref || '');
      if (!m || !allowed.has(m[1])) return { status: 404 };
      if (!googleKey) return { status: 503 };
      const w = Math.min(1600, Math.max(100, parseInt(width, 10) || 480));
      const res = await fetch(`${placesBase}/${m[0]}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${encodeURIComponent(googleKey)}`);
      if (!res.ok) return { status: 502 };
      const j = await res.json();
      if (typeof j.photoUri !== 'string' || !G_IMG.test(j.photoUri)) return { status: 502 };
      return { redirect: j.photoUri };
    }
  };
}
