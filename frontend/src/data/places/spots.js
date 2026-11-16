/* ============ SPOTS: one specific, named venue for each stop that maps to a real place ============
   SPOT[destId][stop title] = [venue name, Google Place ID]
   A Place ID is an identifier, so it is fine to keep here. Ratings, photos and reviews are never stored in this file:
   the Cloudflare build fetches them live through its own server (see cloudflare/). Stops with no entry (a spa afternoon, an
   airport transfer) stay generic on purpose, because a free-text Maps search for them returns ads and unrelated places. */
const SPOT = {
  hoian: {
    "Lantern-lit Old Town stroll":  ["Japanese Covered Bridge (Chùa Cầu)", "ChIJWewCLXwOQjERRkh9adZkWHY"],
    "Banh mi at the central market": ["Bánh Mì Phượng", "ChIJdbnbh9UNQjER12kILnndFNI"],
    "Market visit & cooking class":  ["Red Bridge Cooking School", "ChIJtcXcC7UNQjER3x9vm_Q33RE"],
    "Lantern-making workshop":       ["Lantern Making Class With Lynn", "ChIJPXH2hcYPQjER4lmqua1LH1s"],
    "Cao lau lunch crawl":           ["Morning Glory Original", "ChIJWUA1WX4OQjERWSzif63XzMI"]
  },
  lisbon: {
    "Miradouro viewpoint at golden hour": ["Miradouro da Senhora do Monte", "ChIJV32DNI8zGQ0R9GqiWeuNH2E"],
    "Pastel de nata at a corner bakery":  ["Manteigaria", "ChIJcxYntH80GQ0RX2Him1Z7r-g"],
    "Time Out Market lunch":              ["Time Out Market Lisboa", "ChIJdWBeWYc0GQ0RktxySU7hjxM"],
    "Belém Tower & the river path":       ["Belém Tower", "ChIJS5zCw0LLHg0RP1FSz63cAjA"],
    "Pastéis de Belém & MAAT":            ["Pastéis de Belém", "ChIJW3H9LkXLHg0RZZZttMb27_8"],
    "LX Factory lunch & bookshop":        ["Ler Devagar", "ChIJ5dveYa80GQ0R8l4PI1WAAWw"],
    "Quinta da Regaleira wells":          ["Quinta da Regaleira", "ChIJe9TGZMLaHg0RI2WK1BbF4b8"],
    "Pena Palace gardens":                ["Pena Palace", "ChIJZ1qc8r_aHg0RWDtny30aJ3c"]
  },
  oaxaca: {
    "Zócalo stroll & fresh nieve":        ["Zócalo de Oaxaca", "ChIJh7bVf0Aix4UR-GfJMt6DY1A"],
    "Mezcal tasting in a courtyard bar":  ["Mezcalería In Situ", "ChIJB5U3Uj4ix4URyPDNh8_uuKI"],
    "Mercado 20 de Noviembre breakfast":  ["Mercado 20 de Noviembre", "ChIJMQzuIkAix4URds0rimieBR0"],
    "Walk Calle Alcalá to Santo Domingo": ["Templo de Santo Domingo de Guzmán", "ChIJg9-i1kuEzoYReGAmJh3n7Ro"],
    "Monte Albán at opening time":        ["Monte Albán", "ChIJye-MvYkYx4URytLQj24Grqc"],
    "Hierve el Agua viewpoint":           ["Hierve el Agua", "ChIJ45FElP7IwIUR_Y671emlmy0"],
    "Lunch under the giant Tule tree":    ["Árbol del Tule", "ChIJMa-f5Fskx4URflVW42dh7O8"]
  },
  kyoto: {
    "Pontocho alley dinner":              ["Pontocho Alley", "ChIJP2DblBgJAWARAgLlF0vWT6o"],
    "Early Fushimi Inari gates":          ["Fushimi Inari Taisha", "ChIJIW0uPRUPAWAR6eI6dRzKGns"],
    "Arashiyama bamboo grove at dawn":    ["Arashiyama Bamboo Forest", "ChIJrYtcv-urAWAR3XzWvXv8n_s"],
    "Tenryu-ji garden & moss walk":       ["Tenryū-ji", "ChIJk54PuAGqAWARwEgz_9o-nM0"],
    "Kinkaku-ji in morning light":        ["Kinkaku-ji", "ChIJvUbrwCCoAWARX2QiHCsn5A4"],
    "Nishiki Market tasting":             ["Nishiki Market", "ChIJT8uMzZwIAWARnGzsARCjnrY"],
    "Ryoan-ji rock garden":               ["Ryōan-ji", "ChIJp7ocMCqoAWARQoXXRj4Xq-E"],
    "Deer park & Todai-ji":               ["Tōdai-ji", "ChIJ3XYIepA5AWARjzzVnT-skPg"]
  },
  reykjavik: {
    "Hot dog at Bæjarins Beztu":          ["Bæjarins Beztu Pylsur", "ChIJu66lMC0L1kgReTpj_Nwsoe4"],
    "Laugardalslaug hot pools":           ["Laugardalslaug", "ChIJD5XBi-p01kgRmLvRMAhTJIo"],
    "Hallgrímskirkja tower view":         ["Hallgrímskirkja", "ChIJtS1DoMx01kgR76qdSMQor_c"],
    "Gullfoss waterfall":                 ["Gullfoss", "ChIJ_W-9cc6l1kgRZbQlcba-FYc"],
    "Secret Lagoon soak":                 ["Secret Lagoon", "ChIJAzrP-_OV1kgRqbTTIAgihLo"],
    "Blue Lagoon soak":                   ["Blue Lagoon", "ChIJDd_3r2Yd1kgRbvAWRIl6dPM"]
  }
};
const GID_RE = /^[A-Za-z0-9_-]{20,200}$/;
const spotOf = (destId, title) => { const s = SPOT[destId] && SPOT[destId][title]; return s && GID_RE.test(s[1]) ? { name:s[0], gid:s[1] } : null; };
