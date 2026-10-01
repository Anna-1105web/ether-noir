# ÉTHER NOIR — 3D Luxury Fragrance

Immersive one-page website for a fictional men's fragrance house (portfolio concept).
Real-time 3D bottles, scroll animations, EN / UA / RU, adapted for phones.

Everything the site needs is inside this folder. It loads nothing from the internet.

## Files

```
index.html                         the page
.nojekyll                          tells GitHub Pages to serve the folder as-is
assets/
  css/
    fonts.css                      font declarations (local files)
    style.css                      all styles, including the mobile version
  js/
    i18n.js                        all texts: translations = { en, ua, ru } + language switch
    main.js                        3D scene, bottles, smoke, notes, scroll animations
    vendor/three.min.js            Three.js r160 (3D engine)
    vendor/three.LICENSE.txt       its MIT licence
  fonts/
    Italiana-Regular.woff          headings
    TenorSans-Regular.woff         body text, labels
    BodoniModa-Italic-Variable.woff  italic accents
    IBMPlexMono-Light.woff         captions
    IBMPlexMono-Regular.woff       captions
    Forum-Regular.woff             Cyrillic letters in headings (UA / RU)
    CormorantGaramond-Italic.woff  Cyrillic letters in italics (UA / RU)
    OFL-*.txt                      font licences (required to redistribute the fonts)
  images/
    ether-noir-key-visual.jpg      Story section photo
    favicon.svg                    browser-tab icon
```

The bottles, cap, stone ledge, smoke, particles, the ingredients (bergamot, pepper, cypress,
cedar, amber) and the bottle label are drawn by `main.js` in the browser. They are part of the code,
so they cannot go missing; there are no separate 3D model or texture files.

## Publish on GitHub Pages

1. Upload the **contents** of this folder to a repository, keeping the folders (`assets/...`).
2. Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save.
3. The site appears at `https://<user>.github.io/<repo>/`.

## Run locally

Double-click `index.html`, or for the most accurate result run `python -m http.server 8000`
in this folder and open http://localhost:8000.

Portfolio concept. ÉTHER NOIR is a fictional brand.
