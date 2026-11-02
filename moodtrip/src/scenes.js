/* ============ SCENERY: inline SVG, no external images ============ */
let _uid = 0;
const svgWrap = inner => `<svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${inner}</svg>`;
const grad = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const pine = (x, y, h, c) => { const w = h * .5;
  return `<path fill="${c}" d="M${x} ${y-h} L${x+w*.3} ${y-h*.62} H${x+w*.17} L${x+w*.42} ${y-h*.28} H${x+w*.25} L${x+w*.5} ${y} H${x-w*.5} L${x-w*.25} ${y-h*.28} H${x-w*.42} L${x-w*.17} ${y-h*.62} H${x-w*.3} Z"/>`; };
const rect = (x, y, w, h, c, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}" ${extra}/>`;

const SCENES = {
  sea: u => svgWrap(`<defs>${grad('a'+u, [[0,'#FBD3A5'],[.6,'#F6A98A'],[1,'#F3C6A8']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}
    <circle cx="205" cy="104" r="34" fill="#FFF1D0"/>
    ${rect(0,118,300,102,'#3E8FA3')}${rect(0,118,300,10,'#7CC0CB','opacity=".6"')}
    <path d="M178 126h52M186 134h36M194 142h20" stroke="#FFE9B8" stroke-width="3" stroke-linecap="round" opacity=".75"/>
    <path d="M0 152q25-8 50 0t50 0t50 0t50 0t50 0t50 0V220H0z" fill="#2C7C92"/>
    <path d="M0 182q30-8 60 0t60 0t60 0t60 0t60 0V220H0z" fill="#1F6680"/>
    <path d="M60 134l14-24v24z" fill="#FFF8EA"/><path d="M76 134l-2-18 10 18z" fill="#F9D9BF"/><path d="M56 135h32l-5 6H62z" fill="#8A4B3A"/>`),
  mountain: u => svgWrap(`<defs>${grad('a'+u, [[0,'#C6D9F0'],[1,'#F6E7E6']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}<circle cx="70" cy="58" r="18" fill="#FFF6E3"/>
    <path d="M-10 172L60 96l45 44 45-60 65 70 45-50 70 60v60H-10z" fill="#9DB4D1"/>
    <path d="M-10 204L40 132l45 44 55-72 60 76 50-46 80 62v24H-10z" fill="#5F7A9F"/>
    <path d="M140 104l-18 24 10-4 8 8 9-9 9 5z" fill="#fff" opacity=".92"/>
    <path d="M-10 206q90-22 170-4t170-8V220H-10z" fill="#3E5B4A"/>${pine(40,212,26,'#2C4638')}${pine(62,214,20,'#2C4638')}${pine(250,212,28,'#2C4638')}`),
  city: u => { let win = '';
    const b = [[8,134,38],[50,106,30],[84,142,44],[132,84,34],[170,124,48],[222,102,32],[258,142,44]];
    b.forEach(([x, y, w], bi) => { for (let r = y + 10; r < 212; r += 14) for (let c = x + 6; c < x + w - 6; c += 10)
      if (((r * 7 + c * 3 + bi) % 5) < 2) win += rect(c, r, 4, 6, (r + c) % 3 ? '#FFC857' : '#FF8FB1'); });
    return svgWrap(`<defs>${grad('a'+u, [[0,'#17123A'],[.7,'#4A2F6E'],[1,'#B24F7C']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}<circle cx="232" cy="46" r="15" fill="#FFF3D6"/>
    <g fill="#fff" opacity=".7"><circle cx="30" cy="30" r="1.2"/><circle cx="80" cy="52" r="1"/><circle cx="130" cy="24" r="1.3"/><circle cx="180" cy="60" r="1"/><circle cx="268" cy="86" r="1.1"/><circle cx="110" cy="70" r="1"/></g>
    <g fill="#0F0C24">${b.map(([x, y, w]) => `<rect x="${x}" y="${y}" width="${w}" height="${220-y}"/>`).join('')}</g>${win}
    <path d="M150 84v-14" stroke="#0F0C24" stroke-width="2"/>`); },
  forest: u => svgWrap(`<defs>${grad('a'+u, [[0,'#EEF6DC'],[1,'#BFDDA6']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}<circle cx="224" cy="58" r="26" fill="#FFFBE0" opacity=".9"/>
    ${[20,70,120,176,232,282].map((x,i)=>pine(x,150,70+(i%3)*10,'#A5C896')).join('')}
    ${[0,52,100,152,208,262].map((x,i)=>pine(x,184,92+(i%2)*14,'#5E9460')).join('')}
    ${[26,90,150,214,276].map((x,i)=>pine(x,226,128+(i%3)*10,'#2F6B3F')).join('')}
    <path d="M0 202q60-10 130-2t170-6V220H0z" fill="#25552F"/>`),
  hoian: u => svgWrap(`<defs>${grad('a'+u, [[0,'#FFD98A'],[1,'#F7A55F']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}
    ${rect(0,142,300,78,'#2D6F80')}
    <path d="M0 146h300" stroke="#7CC0CB" stroke-width="2" opacity=".6"/>
    <path d="M18 130h58v-34L47 80 18 96z" fill="#F5C453"/><path d="M12 98L47 78l35 20-4 5-31-17-31 17z" fill="#B4563A"/>${rect(30,110,10,20,'#6B3A2A')}${rect(54,108,10,12,'#6B3A2A')}
    <path d="M84 130h64v-44L116 70 84 86z" fill="#F2A65A"/><path d="M78 88l38-20 38 20-4 5-34-17-34 17z" fill="#A24A33"/>${rect(98,104,12,26,'#6B3A2A')}${rect(122,102,12,14,'#6B3A2A')}
    <path d="M156 130h60v-40l-30-16-30 16z" fill="#F5C453"/><path d="M150 92l36-20 36 20-4 5-32-17-32 17z" fill="#B4563A"/>${rect(172,106,12,24,'#6B3A2A')}
    <path d="M226 130h62v-32l-31-14-31 14z" fill="#E98E4B"/><path d="M220 100l37-18 37 18-4 5-33-15-33 15z" fill="#A24A33"/>
    <path d="M0 40Q75 74 150 44T300 52" stroke="#6B3A2A" stroke-width="1.6" fill="none"/>
    ${[[28,56,'#E8452C'],[70,66,'#F58A2E'],[112,60,'#E8452C'],[154,46,'#FFC857'],[196,48,'#E8452C'],[238,52,'#F58A2E'],[278,56,'#E8452C']].map(([x,y,c])=>`<circle cx="${x}" cy="${y+8}" r="9" fill="${c}"/><circle cx="${x}" cy="${y+8}" r="14" fill="${c}" opacity=".2"/><path d="M${x} ${y+17}v8" stroke="${c}" stroke-width="1.5"/>`).join('')}
    ${[[40,164,'#E8452C'],[110,176,'#F58A2E'],[190,168,'#FFC857'],[250,182,'#E8452C']].map(([x,y,c])=>`<ellipse cx="${x}" cy="${y}" rx="14" ry="3" fill="${c}" opacity=".6"/>`).join('')}
    <path d="M200 198l16-6h46l12 6z" fill="#3B2A22"/>`),
  lisbon: u => { let h = '';
    const pal = ['#F2D39B','#E9A78D','#F6E7CB','#D98A66','#EDC24F'];
    for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++){
      const x = c * 36 - r * 12 + (r % 2) * 14 - 10, y = 66 + r * 19 + c * 4;
      h += rect(x, y, 31, 22, pal[(r * 3 + c * 2) % 5]) + `<path d="M${x-2} ${y} l17-9 l17 9z" fill="#C4572F"/>` + rect(x+8, y+6, 6, 9, '#6C4A3C', 'opacity=".55"') + rect(x+19, y+6, 5, 7, '#6C4A3C', 'opacity=".4"'); }
    return svgWrap(`<defs>${grad('a'+u, [[0,'#8EC5F0'],[1,'#EAF5FB']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}<circle cx="248" cy="40" r="16" fill="#FFF6D6"/>${h}
    ${rect(0,176,300,44,'#3F8FC2')}<path d="M0 186q20-6 40 0t40 0t40 0t40 0t40 0t40 0t40 0" stroke="#9AD0EE" stroke-width="2" fill="none"/>
    ${rect(40,150,52,22,'#F2B632')}${rect(46,155,10,8,'#FFF3C4')}${rect(60,155,10,8,'#FFF3C4')}${rect(74,155,10,8,'#FFF3C4')}<path d="M66 150v-14M58 136h16" stroke="#3B2A22" stroke-width="2"/>`); },
  oaxaca: u => svgWrap(`<defs>${grad('a'+u, [[0,'#FFCF7A'],[1,'#F78F6B']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}
    <path d="M-10 128l50-44 40 30 50-52 60 56 50-34 70 44v60H-10z" fill="#B76A7A" opacity=".75"/>
    ${[[0,'#E85D8B',104],[58,'#2BA6A0',90],[116,'#F5C242',108],[174,'#F28A3B',94],[232,'#7B5CC8',106]].map(([x,c,y])=>`${rect(x,y,62,220-y,c)}${rect(x,y,62,7,'#fff','opacity=".28"')}${rect(x+10,y+22,14,20,'#3A2630')}${rect(x+36,y+22,14,20,'#3A2630')}${rect(x+20,y+66,20,54,'#3A2630','opacity=".82"')}`).join('')}
    <path d="M0 30Q75 56 150 34T300 40" stroke="#3A2630" stroke-width="1.4" fill="none"/>
    ${Array.from({length:12},(_, i)=>{ const x = 10 + i * 25, y = 34 + Math.sin(i * .9) * 8 + (i > 5 ? -2 : 4); return `<path d="M${x} ${y}h16v18l-3-3-3 3-2-3-3 3-2-3-3 3z" fill="${['#E85D8B','#2BA6A0','#F5C242','#fff','#7B5CC8'][i%5]}"/>`; }).join('')}`),
  kyoto: u => svgWrap(`<defs>${grad('a'+u, [[0,'#F9D7E3'],[1,'#FFF4EC']])}</defs>
    ${rect(0,0,300,220,`url(#a${u})`)}
    <path d="M-10 150q60-50 130-22t200-30v122H-10z" fill="#E9CCD7" opacity=".85"/>
    <path d="M214 160v-70h4V70h10v20h4v70z" fill="#8A5A55"/><path d="M204 92h46l-6-10h-34zM208 116h38l-5-9h-28zM212 140h30l-4-8h-22z" fill="#6E403D"/>
    <path d="M70 178v-84M130 178v-84" stroke="#D6402C" stroke-width="10"/><path d="M56 100q44 8 88 0v-12q-44 8-88 0z" fill="#D6402C"/><path d="M64 118h72" stroke="#D6402C" stroke-width="7"/>
    <path d="M-10 190q80-14 160-4t160-8v42H-10z" fill="#9D6B63" opacity=".55"/>
    <path d="M0 20q50 10 90 40" stroke="#6E403D" stroke-width="3" fill="none"/>
    ${[[18,28],[34,38],[52,48],[70,58],[26,48],[44,60],[84,64],[12,12],[40,22],[60,34]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${7+(i%3)*2}" fill="${i%2?'#F6A9C4':'#FAC9DA'}"/>`).join('')}
    ${[[160,60],[190,100],[250,140],[110,150],[280,60]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3" fill="#F6A9C4"/>`).join('')}
    <path d="M0 176q70-14 150-4t150-10v10H0z" fill="#fff" opacity=".45"/>`),
  reykjavik: u => svgWrap(`<defs>${grad('a'+u, [[0,'#071A33'],[1,'#12506A']])}
    <linearGradient id="b${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5BF0B2" stop-opacity=".0"/><stop offset=".5" stop-color="#5BF0B2" stop-opacity=".55"/><stop offset="1" stop-color="#8B7CFF" stop-opacity=".0"/></linearGradient></defs>
    ${rect(0,0,300,220,`url(#a${u})`)}
    <path d="M-10 40Q60 90 120 50T220 60T310 20V110Q230 80 170 100T60 120T-10 90z" fill="url(#b${u})"/>
    <g fill="#fff" opacity=".75"><circle cx="24" cy="26" r="1.2"/><circle cx="96" cy="14" r="1"/><circle cx="168" cy="22" r="1.3"/><circle cx="262" cy="42" r="1"/><circle cx="214" cy="12" r="1"/></g>
    <path d="M-10 150l60-52 42 36 52-60 66 64 40-30 60 40v72H-10z" fill="#2B3E5E"/>
    <path d="M142 74l-16 20 8-4 8 8 8-8 9 5z" fill="#EAF2FA"/><path d="M50 98l-12 14 7-3 5 6 6-5 5 3z" fill="#EAF2FA"/>
    ${rect(0,186,300,34,'#E9EEF3')}
    <path d="M152 196v-58l-6-6v-8l6-10 6 10v8l-6 6z" fill="#F4F7FA"/><path d="M146 150h12M146 168h12" stroke="#B9C6D6" stroke-width="2"/>${rect(138,186,28,10,'#F4F7FA')}
    ${[[10,'#D8504A'],[42,'#3C8DBC'],[76,'#E9B949'],[200,'#D8504A'],[236,'#2BA6A0'],[266,'#3C8DBC']].map(([x,c])=>`<path d="M${x} 196v-12l12-8 12 8v12z" fill="${c}"/>`).join('')}`)
};
const scene = name => SCENES[name]('s' + (++_uid));

/* Background horizon silhouettes (fill follows --accent) */
const HORIZON = {
  sea: '<svg viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true"><path opacity=".45" d="M0 110q90-40 180 0t180 0t180 0t180 0t180 0t180 0t180 0t180 0V240H0z"/><path opacity=".7" d="M0 150q120-44 240 0t240 0t240 0t240 0t240 0t240 0V240H0z"/><path d="M0 196q100-30 200 0t200 0t200 0t200 0t200 0t200 0t200 0t200 0V240H0z"/></svg>',
  mountain: '<svg viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true"><path opacity=".45" d="M0 240V120l160-80 150 90 190-110 200 120 210-100 200 110 170-90 160 70V240z"/><path d="M0 240V170l220-90 190 100 240-130 210 140 230-100 180 90 170-40V240z"/></svg>',
  city: '<svg viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true"><path opacity=".5" d="M0 240V120h70V80h60v60h50V100h70v60h60V70h80v90h60V110h80v50h70V90h70v70h60V120h90v40h70V80h70v90h60V110h90v130z"/><path d="M0 240V170h90V130h70v50h80V150h60v40h100V120h60v70h90V160h80v30h90V140h70v50h100V150h80v40h110V130h70v110z"/></svg>',
  forest: '<svg viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true"><path opacity=".45" d="M0 240V160l24-60 24 60 14-30 22 40 20-70 24 70 18-34 22 44 22-80 24 80 16-30 22 40 22-64 24 64 14-26 24 40 22-76 24 76 18-30 22 38 20-60 24 60 14-30 24 44 20-70 24 70 18-30 22 40 22-64 24 64 14-26 24 40 20-70 24 70 18-34 22 44 22-80 24 80 16-30 22 40 22-64 24 64 14-26 24 40 22-76 24 76 18-30 22 38 20-60 24 60 14-30 24 44 20-70 24 70 18-30 22 40 22-64 24 64z"/><path d="M0 240V190l30-70 30 70 20-34 26 50 24-90 28 90 20-40 26 54 26-98 28 98 18-34 26 46 26-76 28 76 16-30 28 48 24-86 28 86 20-34 26 44 24-70 28 70 16-34 28 50 24-84 28 84 20-34 26 46 26-76 28 76 16-30 28 48 24-86 28 86 20-34 26 44 24-70 28 70 16-34 28 50 24-84 28 84 20-34 26 46 26-76 28 76 16-30 28 48 24-86 28 86 20-34 26 44z"/></svg>'
};

/* Small line icons for the bag tiles (24px grid) */
const ICON = {
  journal:   '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5v17M12.5 8h3.5M12.5 11.5h3.5"/>',
  swim:      '<circle cx="12" cy="8.5" r="3.4"/><path d="M12 2.5v1.3M5.8 8.5H4.5M19.5 8.5h-1.3M7.6 4.1l.9.9M16.4 4.1l-.9.9"/><path d="M3 15.5q3-2.6 6 0t6 0t6 0M3 19.5q3-2.6 6 0t6 0t6 0"/>',
  paperback: '<path d="M12 6.5C10 5 7.5 4.6 4.5 5v12.5c3-.4 5.5 0 7.5 1.5 2-1.5 4.5-1.9 7.5-1.5V5C16.5 4.6 14 5 12 6.5zM12 6.5V19"/>',
  camera:    '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
  shoes:     '<path d="M4 4.5h5.5V10c0 1.6 1 2.7 2.6 3.2l4.6 1.4c2 .6 3.3 1.6 3.3 3.4V19H4z"/><path d="M4 16h16.5M7 7.2h2.5M7 9.8h2.5"/>',
  phones:    '<path d="M5 15v-3a7 7 0 0 1 14 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.6"/>',
  sketch:    '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>',
  party:     '<path d="M8.5 4L3.5 7l2 4 2.5-1V20h8V10l2.5 1 2-4-5-3c-.5 1.6-1.9 2.5-3.5 2.5S9 5.6 8.5 4z"/>'
};
const icon = id => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg>`;
