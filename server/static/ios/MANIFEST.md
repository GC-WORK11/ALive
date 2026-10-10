# iOS device-stage assets — clips, posters, stills

Built 2025-10-09 for the landing page's dark device stage (one glass iPhone, six chapters).

**Source:** `alive-ios-demo-v2.mp4` (Devin attachment 18c37fc6…, fetched through the v1 attachments API).
It's 87.6 s, 1206x2622, 30 fps, H.264 High, no audio, release build. It's an edit made of takes:
most scenes are 3.5–6 s holds joined by hard cuts. All timestamps below are source time
(frame *n* = *n*/30 s). All cuts are frame-exact.

## Assets

Clips are **720x1566**, 30 fps, muted (no audio track). Posters are 720x1566. Stills are native **1206x2622**.

| Feature | Files (size) | Source (frames / s) | What it shows | Loop method | Verdict |
|---|---|---|---|---|---|
| compare | ios-compare.mp4 (276 KB) · .webm (328 KB) · -poster.webp (88 KB) · -still.webp (183 KB) | clip 2103–2237 = **70.10–74.57 s**; playback starts at 2109 (70.30 s), 4.30 s. Still: 2129 (70.97 s) | Your location → Khan Market, "3 min old" (green dot), route "8 min · ~2.3 µg". The alternates list opens on Auto-rickshaw ≈6 (default, +9% air) and Bike/scooter ≈6, then scrolls through Auto alt 2 ≈7, Metro + walk ≈12, Bus 181B ≈19, Bicycle ≈22/25/26/28 and On foot ≈53, with "~3× … ~13.8× more inhaled than car" | 6-frame crossfade (scroll end → static top); seam MAD 0.85 vs median step 2.8 | **USE.** This is the richest compare moment in the film. The first card's title is clipped by the list viewport, as captured. The scroll is quick (≈3 s). I skipped the other compare holds (36.60–45.03 s): their "air by hour" row overflows to x=0, the Hauz Khas one has a spinner ("adding metro, bus and more…"), and the Khan Market one has an orange "12 min old" chip |
| stays | ios-stays.mp4 (65 KB) · .webm (126 KB) · -poster.webp (53 KB) · -still.webp (106 KB) | clip 1700–1831 = **56.67–61.03 s**, 4.40 s. Still: 1828 (60.93 s) | "where to stay · near you · your air ~47 µg". The Hotel W is lightest (~56 µg, 0.6 µg lighter), then Hotel York, The Hans Plaza, Man Singh Palace and Divine Hotel, all ~56 µg "same air" | Cut on identical frames (the source is a fully static hold); seam MAD 0.06 | **USE (static).** There's no motion in the source, so the poster and the still look the same as the clip. The ranking is flat: everything is ~56 µg and the top pick is only 0.6 µg lighter |
| hours | ios-hours.mp4 (60 KB) · .webm (122 KB) · -poster.webp (51 KB) · -still.webp (101 KB) | clip 1835–1934 = **61.17–64.47 s**, plus 20 frames holding 1934; 4.00 s. Still: 1846 (61.53 s) | "when to go out · rolling 24 h": a 24 h bar curve, now 19:30 → 18:30 tomorrow. Says "no clean stretch on the horizon — lightest reads 46 µg/m³", "heaviest — tomorrow 17:30—… · ~87 µg", "24 h avg ~56 µg/m³" | Cut on identical frames. The source hold is only 3.5 s, so I padded it with 0.67 s of the identical last frame; seam MAD 0.05 | **USE, with a copy caveat.** It's static. There is no clean window, so this screen can't show "the cleanest window, named". The heaviest end time is truncated ("17:30—…") |
| nav | ios-nav.mp4 (90 KB) · .webm (191 KB) · -poster.webp (70 KB) · -still.webp (157 KB) | clip 1461–1577 = **48.70–52.57 s**, plus 15 frames holding 1577; playback starts at 1467 (48.90 s), 4.20 s. Still: 1576 (52.53 s) | Live nav "Head out" with the route on the labelled map, "8 min · 4.9 km left · arrive 8:09 pm". The counters tick: ride 1 g → 5 g at 0.7 s, then 6 g and "≈0.1 µg" breathed at 2.9 s | 6-frame crossfade (6 g → 1 g; the status-bar location arrow fades back in); seam MAD 0.27 | **USE.** It counts up in order, then resets with a 0.2 s dissolve. The values are tiny (≈0.1 µg). The poster is the start state (0 µg / 1 g); the still is the end state (≈0.1 µg / 6 g) |
| receipt | ios-receipt.mp4 (82 KB) · .webm (190 KB) · -poster.webp (71 KB) · -still.webp (153 KB) | clip 1578–1697 = **52.60–56.57 s**, 4.00 s. Still: 1696 (56.53 s) | End card over the nav map: "ended before it really started — under 100 m — nothing counted — kept on this phone only — Done" | Cut on identical frames (static); seam MAD 0.06 | **THIN.** This is the only receipt in v2, and it's the "nothing counted" card for trips under 100 m. There's no µg receipt anywhere in the film. A real "receipt lands in µg" shot needs a re-record |
| map | ios-map.mp4 (155 KB) · .webm (222 KB) · -poster.webp (128 KB) · -still.webp (268 KB) | clip 300–377 = **10.00–12.57 s**, plus 48 frames holding 377; playback starts at 306 (10.20 s), 4.00 s. Still: 377 (12.57 s) | Air map around Connaught Place with the hint "tap anywhere — that spot's air answers". At 2.0 s the readout "48 µg/m³ — satisfactory · Palika Kendra" appears, and the "48" tap pin lands at 2.2 s. Bottom card: "your day so far · now ~47 µg/m³ · no reads yet" | 6-frame crossfade (readout → hint); seam MAD 0.51 | **RETOUCHED — use only if retouching is acceptable.** Every air-map frame in v2 (7.60–12.57 s) has the banned stale badge "· older data — reconne(cting)" at the end of the legend row. In every frame of the clip and in the still, I painted out x ≥ 858, y 372–404 (native px), filling it with a vertical interpolation of the card background (feathered 20 px). The row now ends "good → severe · leans with the wind". Nothing else is touched, and every clip frame was checked: no ink is left in that zone. If a retouch is off the table, v2 has no clean map footage: re-record, or fall back to `../screens/scr-map-ios.webp` (older capture) |

## Colour

The film is tagged Display-P3 primaries (smpte432). But its pixels hold the **sRGB design values**:

- the satisfactory dot samples at 199,162,80 (band1 #C7A34F = 199,163,79);
- the forest CTA samples at 53,95,75 (#35614B).

I decoded with the bt709 matrix (limited range) and left the values unchanged.

- **Video:** every file is re-tagged bt709 primaries / sRGB (iec61966-2-1) transfer / bt709 matrix / tv range. A colour-managed browser therefore won't push the colours toward P3, and the colours match the posters.
- **Posters and stills:** untagged sRGB WebP.
- **Result:** there's no colour jump when a poster swaps to its video. Measured MAD between each poster and the decoded frame 0 is 0.9–1.9, which is compression noise only.

## Encoding

- **Pipeline:** each output frame is rendered from frame-exact source frames (Lanczos 1206→720, crossfades in RGB) into a lossless FFV1 intermediate. Both encodes are made from that intermediate.
- **H.264:** libx264, `-preset veryslow -crf 26 -profile:v high -level 4.0 -g 300 -sc_threshold 0 -bf 3 -movflags +faststart -an`. That gives one GOP per clip, so there's no keyframe "pulse" on the static UI and no pulse at the seam. moov comes before mdat (checked). PSNR against the intermediate is 42.8–47.6 dB.
- **VP9:** two-pass libvpx-vp9, `-b:v 0 -crf 33 -deadline good -cpu-used 1 -row-mt 1 -auto-alt-ref 1 -lag-in-frames 25 -g 300 -an`. PSNR is 49–60 dB.
- **Posters:** WebP q85 (method 6) of each clip's frame 0.
- **Stills:** WebP q88 (method 6). Each one is the sharpest frame of its hold (Laplacian variance).
- **Size:** every file is ≤ 335 KB (the cap was 1.2 MB). The folder totals 3.3 MB.

## Film timeline (v2)

| Frames | Time (s) | Surface | Notes |
|---|---|---|---|
| 0–10 | 0.00–0.33 | Springboard → launch → splash "a*" wordmark → white | AVOID (wordmark case is deliberate) |
| 11–107 | 0.37–3.57 | Home "the air around you 47 µg/m³" under a coach card ("the air is sitting over the city…", skip/next) | dimmed |
| 108–227 | 3.60–7.57 | Home "Good evening": where to?, air-map card ("54 live stations · air reading: 15 min old"), Delhi today, Trips, "the move" | |
| 228–377 | 7.60–12.57 | **Air map** (CP). Tap readout 48 µg/m³ from 366 (12.20 s) | banned "older data — reconnecting" in every frame → ios-map retouched |
| 378–497 | 12.60–16.57 | **Where-to**, empty, plus "air answers: where to stay / when to go out" | no keyboard |
| 498–647 | 16.60–21.57 | Where-to results for "hauz khas" | no keyboard |
| 648–767 | 21.60–25.57 | Route map "finding the purest route for you…" ("1 min old") | loading |
| 768–887 | 25.60–29.57 | "before you pick" vehicle explainer | |
| 888–905 | 29.60–30.17 | **Vehicle chips** "What are you taking?" | 0.6 s only |
| 906–1097 | 30.20–36.57 | Toast "got it — estimates now use your ride." over the dimmed plan | |
| 1098–1217 | 36.60–40.57 | **Plan/compare** Hauz Khas: Car (AC) least smoky, ≈2, "7 min old" | spinner; "air by hour" row overflows left |
| 1218–1226 | 40.60–40.87 | transition | |
| 1227–1351 | 40.90–45.03 | Plan/compare Khan Market: Car (AC), ≈2 | "12 min old" orange dot; card overflow |
| 1352–1398 | 45.07–46.60 | **Start** → nav overview "Head out" (0 µg, "10 m left") | |
| 1399–1577 | 46.63–52.57 | **Live nav**. Tiles load at 1413, labels at 1461; counters 1 g → 5 g (1488), 6 g + ≈0.1 µg (1555) | → ios-nav |
| 1578–1697 | 52.60–56.57 | **End receipt** "ended before it really started — nothing counted" | → ios-receipt |
| 1698–1832 | 56.60–61.07 | **Stays** "where to stay" | → ios-stays |
| 1833–1937 | 61.10–64.57 | **When to go out** 24 h curve | → ios-hours |
| 1938–2012 | 64.60–67.07 | Vehicle chips (Khan Market) | |
| 2013–2081 | 67.10–69.37 | PUC certificate (optional): BS stage, CO %, HC ppm | |
| 2082–2102 | 69.40–70.07 | Toast "petrol car" → route loading | |
| 2103–2147 | 70.10–71.57 | Compare alternates, static (Auto ≈6, Bike/scooter ≈6), "3 min old" | → ios-compare |
| 2148–2237 | 71.60–74.57 | Compare list scroll (Metro, Bus, Bicycle, On foot) | → ios-compare |
| 2238–2342 | 74.60–78.07 | Where-to with recents (Khan Market, Hauz Khas Village Road) | |
| 2343–2364 | 78.10–78.80 | **Back/close**: plan sheet closes → crossfade to home | |
| 2365–2627 | 78.83–87.60 | Home "Good evening · you've breathed today 17 µg · 8% of the daily limit" ("6 min old") | |

## Checks against the brief

- **Splash:** not used.
- **Keyboard:** none appears anywhere in v2.
- **Consent copy:** "counts as sharing on" appears nowhere in v2. The film has no onboarding or consent screens. Its only privacy lines are "nothing leaves this phone", "saved on this phone only" and "kept on this phone only".
- **"Reconnecting / older data" badge:** it only appears on the air map. It's retouched out of ios-map.*.
- **Freshness chips:** the chips in the clips are green-dot "N min old" freshness chips (3 min, on compare), not the stale badge.


## REJECTED by the lead — ios-map.*
The map clip/still had the app's "older data — reconnecting" badge painted out. Editing a real capture to remove an honesty label is staging; it is not shipped. Files moved to /tmp/ios-film/rejected-retouched/. Map surfaces use unretouched captures only (screens/scr-map-ios.webp, screens/scr-map-android.webp).
