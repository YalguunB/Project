"use strict";
/* features/reviews/photo-form.js — Reviews: photo picking and the review form. */
/* ---------- review photos: picked, shrunk in the browser, uploaded as an asset only when the review is posted ---------- */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
let photo = { blob:null, url:null, remove:false };
function resetPhoto(){ if (photo.url){ try { URL.revokeObjectURL(photo.url); } catch (e) {} } photo = { blob:null, url:null, remove:false }; }
function photoFieldHTML(mine){
  const has = !!(mine && mine.ph);
  return `<div class="pphoto" id="pPhoto"><span class="label muted">A photo · optional</span>
    <div class="pp-row">
      <div class="pp-thumb" id="ppThumb" ${has ? '' : 'hidden'}><img id="ppImg" class="pp-img" alt="Your photo" ${has ? `src="/_blob/${mine.ph}"` : ''}><button type="button" class="icon-btn" data-act="phremove" aria-label="Remove photo">×</button></div>
      <input type="file" id="pfile" class="sr" accept="image/jpeg,image/png,image/webp,image/gif"><label for="pfile" class="btn btn-secondary btn-sm pp-pick" id="ppBtn">${has ? 'Change photo' : 'Add a photo'}</label>
    </div>
    <small class="fine" id="ppNote">JPEG, PNG, WebP or GIF. It is shrunk to fit before it is uploaded.</small></div>`;
}
function paintPhotoField(note, bad){
  const thumb = $('#ppThumb'), img = $('#ppImg'), btn = $('#ppBtn'), n = $('#ppNote'); if (!thumb) return;
  const mine = BE.myReview(pidOf(S.plan.days[locate(placeId)[0]].stops[locate(placeId)[1]]));
  const shown = photo.blob ? photo.url : (!photo.remove && mine && mine.ph ? '/_blob/' + mine.ph : null);
  thumb.hidden = !shown; if (shown) img.src = shown;
  btn.textContent = shown ? 'Change photo' : 'Add a photo';
  n.textContent = note || 'JPEG, PNG, WebP or GIF. It is shrunk to fit before it is uploaded.';
  n.classList.toggle('bad', !!bad);
}
async function shrinkPhoto(file, max = 1280){
  let bmp = null;
  try { bmp = await createImageBitmap(file); } catch (e) {}
  let w, h, src;
  if (bmp){ w = bmp.width; h = bmp.height; src = bmp; }
  else {                                            // older browsers: decode through an <img>
    const u = URL.createObjectURL(file);
    try { src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = u; }); w = src.naturalWidth; h = src.naturalHeight; }
    finally { URL.revokeObjectURL(u); }
  }
  if (!w || !h) throw new Error('empty');
  const k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
  if (bmp && bmp.close) bmp.close();
  const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
  if (!blob) throw new Error('encode');
  return blob;
}
async function pickPhoto(file){
  if (!file || !placeId) return;
  if (!PHOTO_TYPES.includes(file.type)){ paintPhotoField('Pick a JPEG, PNG, WebP or GIF image.', true); return; }
  if (file.size > 30 * 1024 * 1024){ paintPhotoField('That file is very large. Pick a smaller photo.', true); return; }
  paintPhotoField('Preparing your photo…');
  try {
    const blob = await shrinkPhoto(file);
    if (!placeId) return;
    resetPhoto(); photo = { blob, url:URL.createObjectURL(blob), remove:false };
    paintPhotoField(`Ready · ${Math.max(1, Math.round(blob.size / 1024))} KB. It uploads when you post.`);
  } catch (e) { paintPhotoField('Could not read that image. Try a JPEG or PNG.', true); }
}
function setReviewForm(pid){
  resetPhoto(); const box = $('#plForm'); if (!box) return;
  box.innerHTML = reviewFormHTML(pid); FX.bind(box);
}
function reviewFormHTML(pid){
  if (!BE.canPost) return `<p class="notice">${BE.ready ? 'Posting reviews is switched off for your access level. Ask the owner for Contributor access.' : 'Reviews need the shared version of this page.'}</p>`;
  const mine = BE.myReview(pid), rate = mine ? mine.r : 0, feel = mine && mine.f || '', text = mine ? mine.t : '';
  return `<form id="placeForm" class="rform pform" novalidate>
    <p class="label muted">${mine ? 'Your review' : 'Been here? Add yours'}</p>
    <fieldset><legend class="sr">Your rating</legend><div class="strength rate-pick" role="radiogroup">${STAR_WORDS.map((w, i) => `<label class="opt" data-cursor=""><input type="radio" name="prate" value="${i + 1}" ${i + 1 === rate ? 'checked' : ''}><span class="face"><span class="sr">${i + 1} ${plural(i + 1, 'star', 'stars')}, </span><span class="pnr" aria-hidden="true">${i + 1}<i class="rstar"></i></span><small>${w}</small></span></label>`).join('')}</div></fieldset>
    <fieldset><legend class="label muted">How did it feel? Optional</legend><div class="chips" role="radiogroup"><label class="opt chip" data-cursor=""><input type="radio" name="pfeel" value="" ${feel ? '' : 'checked'}><span class="face">Skip</span></label>${FEEL.map(f => `<label class="opt chip" data-cursor=""><input type="radio" name="pfeel" value="${f.id}" ${f.id === feel ? 'checked' : ''}><span class="face">${f.label}</span></label>`).join('')}</div></fieldset>
    <label class="tfield"><span class="label muted">In your words · optional</span><textarea name="ptext" rows="3" maxlength="240" placeholder="What was it like? A line or two helps the next traveler.">${esc(text)}</textarea><small class="count tnum" id="pcount">${text.length} / 240</small></label>
    ${postAsHTML('pas', mine ? !!mine.named : !!BE.account)}
    ${BE.canPhoto ? photoFieldHTML(mine) : ''}
    <p class="notice" id="perr" hidden></p>
    <div class="sheet-foot">${mine ? '<button type="button" class="btn btn-ghost btn-sm" data-act="delreview">Delete my review</button>' : ''}<button class="btn btn-primary btn-sm" type="submit" id="psub">${mine ? 'Update my review' : 'Post review'}</button></div>
  </form>`;
}
