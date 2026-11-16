# Хэрэглэгчийг татах, review бичүүлэх, сегментээр ялгах

Энэ баримт `feature/engage-segments` branch дээр нэмэгдсэн зүйлсийг тайлбарлана.

## 1. Юу нэмэгдсэн бэ

| Хаана | Юу |
|---|---|
| `backend/worker.js` | `profile` гэсэн хувийн коллекц (зөвхөн эзэн нь уншина), `Server-Timing` header, D1 query-г цөөрүүлсэн |
| `wrangler.toml` | `[placement] mode = "smart"` |
| `frontend/src/core/profile.js` | Профайл: хэдэн удаа орсон, ямар аялал төлөвлөсөн/явсан. Сегмент тооцоолно |
| `frontend/src/features/engage/` | Нүүр хуудсан дээрх ганц nudge карт, "Аялал ямар байсан бэ?" одоор үнэлэх sheet |
| `db/seed/` | Гараар бичсэн жишээ дата: нэг удаа аялсан хүн |

## 2. Сегментүүд

`segmentOf(profile)` — **явсан** аяллын тоогоор (`went: true`):

| Сегмент | Нөхцөл | Нүүр хуудсан дээр юу харах вэ |
|---|---|---|
| `new` | 0 аялал | Анх удаа бол юу ч харуулахгүй (хуудас өөрөө танилцуулга). Аялал төлөвлөсөн бол: "Kyoto 6 долоо хоногийн дараа", тухайн сар хэр ачаалалтай, энэ долоо хоногт хэдэн хүн сонгосон |
| `once` | 1 аялал | "Welcome back · How was Kyoto?" → review хүсэлт. Бүгдийг үнэлсэн бол "Ready for trip number two?" + очоогүй газрууд |
| `seasoned` | 2+ аялал | "Seasoned traveler · 3 trips". Review-д нь "3 trips" тэмдэг гарна. Тоглоомыг алгасаад шууд budget руу орох товч |

Асуух дараалал (`nextAsk`): **явсан уу?** → **review** → **удахгүй болох аялал**. Нэг удаад нэг л зүйл асууна.
"Not now" дарвал тухайн аяллын талаар 7 хоног асуухгүй (`snooze`).

## 3. "Дуусах гээд байна, яараарай" — яагаад хуурамчаар бичээгүй вэ

MoodTrip юу ч зардаггүй, тиймээс "2 л үлдлээ" гэх үнэн тоо байхгүй. Зохиомол тоо харуулбал:
хэрэглэгч нэг л удаа анзаарахад итгэл алга болно, EU/US-д хуурамч scarcity нь хууль зөрчсөн "dark pattern" гэж үзэгддэг.

Оронд нь **үнэн** яаралтай байдал ашигласан:
- Хэрэглэгчийн **өөрийн** хуанли: "Kyoto in 6 weeks"
- Тухайн сарын бодит season оноо (`DEST.months`): "November is one of the best and busiest months there, so stays tend to fill early."
- Shared field дахь **жинхэнэ** картын тоо: "3 other travelers picked Kyoto in the field this week" (2-оос бага бол харуулахгүй)

Хэрэв дараа нь partner booking (зочид буудал) холбовол тэдний API-аас ирсэн бодит "rooms left" тоог харуулж болно.

## 4. Нэг удаа аялсан хүний датаг API руу яаж оруулах вэ

### Дата ямар хэлбэртэй вэ

Нэг хүн = 32 тэмдэгттэй `id` + 64 тэмдэгттэй нууц `key`. Анх бичсэн key нь тэр id-г "эзэмшинэ".
Хоёр document бичнэ:

**`PUT /api/db/profile/<id>`** — хэн бэ (`db/seed/profile.json`):
```json
{
  "v": 1,
  "first": 1735689600000,
  "last": 1735689600000,
  "visits": 3,
  "trips": [{
    "dest": "kyoto", "month": 3, "year": 2026, "nights": 4,
    "saved": 1738368000000,
    "went": null,
    "pids": ["kyoto:0:0", "kyoto:0:1", "kyoto:1:0"],
    "snooze": 0
  }]
}
```
- `month` 0-ээс эхэлнэ: 3 = 4-р сар
- `went`: `null` = асуугаагүй, `true` = явсан, `false` = яваагүй
- `pids`: `<газар>:<өдрийн загвар>:<дугаар>`, `frontend/src/core/model.js` доторх `DEST[].days`-аас. `kyoto:1:0` = Kyoto-гийн 2-р загвар өдрийн эхний газар (Fushimi Inari)

**`PUT /api/db/trip/<id>`** — төлөвлөгөө өөрөө (`db/seed/trip.json`).

### Өөрсдөө гараараа нэг удаа бичиж үзэх

```sh
npm run db:local
npm run dev                         # өөр терминал дээр
npm run seed:local        # profile + trip-ийг curl-ээр бичнэ
```

Гаралт:
```
PUT  profile  -> 204
PUT  trip  -> 204
GET  profile (with the key)    -> {"id":"0123...","data":{"v":1,...
GET  profile (without the key) -> {"error":"not_found"}
timing of the last read:        server-timing: db;desc="1 D1 round trips";dur=2, ...
```

Дараа нь браузерт тэр хүн болж харах: `http://localhost:8787` нээгээд DevTools > Console-д скриптийн хэвлэсэн
`localStorage.setItem('mt.who.v1', ...)` мөрийг ажиллуулна. Нүүрэн дээр "Did you make it to Kyoto in April?" гарна →
"Yes, I went" → 8 газрыг одоор үнэлэх sheet → "Post ratings" → карт "How was Kyoto? 6 places… waiting" болж өөрчлөгдөнө.

Дасгал: `profile.json` дотор `"went": true` болгоод дахин ажиллуул, дараа нь өөр 2 аялал нэмж `seasoned` болго.

> Скрипт доторх id/key нь **жишээ**. Хэн ч уншиж болно, жинхэнэ хэрэглэгчид бүү ашигла.
> Deployed сайт руу тест хийсэн бол дараа нь устга: `curl -X DELETE -H "x-mt-key: <key>" <site>/api/db/profile/<id>`

## 5. "Ганц юм хандахад удаад байна" — шалтгаан ба засвар

Хэмжих: DevTools > Network > хүсэлт > **Timing** таб. Одоо бүх `/api/*` хариу `Server-Timing` header-тэй:
`db;desc="4 D1 round trips";dur=…, google;dur=…, total;dur=…`

| Шалтгаан | Өмнө | Одоо |
|---|---|---|
| **D1 руу дараалсан query.** Worker хэрэглэгчийн ойролцоо (Азид) ажилладаг, D1 өөрийн "гэр" бүсэд байдаг. Query бүр тэр хоорондын замыг туулна (≈100–200 мс). | Бичилт бүрт 5–8 дараалсан query (шинэ хүн бол 8) | 4 (rate limit `RETURNING`, owner check `batch`, "байгаа юу + хэд байна" нэг query) |
| | Хувийн trip унших: 2 | 1 (`batch`) |
| **Smart Placement байхгүй** | Worker хэрэглэгчийн дэргэд, DB хол | Worker DB-ийн дэргэд ажиллана, query тус бүр хэдхэн мс. Статик хуудас хэвээр ойрын edge-ээс |
| **Google Places** (`/api/place`) | Газрын самбар нээх бүрт Google руу 1 хүсэлт (≈0.5–1.5 с), зураг бүрт дахин нэг | Хэвээр: Google-ийн нөхцлөөр review/зургийг cache хийж болохгүй. `google;dur=` гэж Server-Timing-д харагдана. Хурдасгах бол hover дээр урьдчилан татаж болно, гэхдээ Google-ийн төлбөр нэмэгдэнэ |

Local дээрх хэмжилт (`wrangler dev`): шинэ бичилт `4 D1 round trips`, өөрчлөгдөөгүй poll `1`, хувийн уншилт `1`.
Жинхэнэ deploy дээр Улаанбаатараас хэмжээд `total;dur`-ийг өмнөх хувилбартай харьцуулаарай.
