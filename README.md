# Sunset Ledger — GTA VI Trophy Guide & Tracker

An offline, open-source guide and tracker for all 55 PlayStation 5 trophies
of Grand Theft Auto VI (1 platinum, 2 gold, 6 silver, 46 bronze, 28 hidden),
built for the make.fun bounty `gta6-trophy-guide-01`.

## What it does

- **Tracker** — every trophy with its official name, description and grade,
  a checklist saved in the browser (localStorage), export and import,
  per-trophy progress counters (meditations, stunts, vehicles…), filters by
  kind, grade, earned state, missable/at-risk and PSN-hidden, plus search
  and roadmap/name/grade sorting.
- **Guide** — a guide to each trophy in our own words, with numbered steps
  and a source tag on every step. Sources are cited beside each guide:
  the official list on Exophase (re-checked live 21 Nov 2026), PSNProfiles
  (via the bounty kit), and PowerPyx's trophy guide & roadmap (read
  20 Nov 2026). Where a source says a fact is unconfirmed, we say so too.
- **Roadmap** — three stages to the platinum (story + questlines 60–80 h,
  the 100% checklist ~100 h, strangers & cleanup 10–20 h), about 200 hours
  total, difficulty 4/10, one playthrough, zero online trophies.
- **Missables** — the one possibly missable trophy (Positive Mental
  Attitude, Chapter 1 balcony meditation) featured with its last chance,
  plus 8 at-risk trophies whose quest givers go quiet mid-story.
- **Sources** — a numbered source list with read dates, and a
  "sources differ" box that shows both sides of the open questions.
- **Spoiler shield** — story trophies stay hidden until earned.

## Run it

Static files, no build step. Serve `app/` with any static server and open
`index.html`, or just open the file — it fetches only its own
`data/trophies.json` and makes no network request at run time.

```sh
cd app && python3 -m http.server 8080
# open http://localhost:8080
```

Demo mode for screenshots: `index.html?demo=1` seeds 13 earned trophies
in memory (not saved); `#roadmap`, `#missables`, `#sources` jump to a view;
`?t=28` opens a trophy.

## Hand in

`main.ts` (Node 22) copies `app/` and `screenshots/` to `/output` and
writes `/output/dossier.json` with `buildDossier` from the kit's
`vendor/makefun-frontend.ts` (unchanged).

## License

MIT. Unofficial fan guide — no Rockstar logo, artwork or screenshots.
Trophy names and descriptions are shown as PlayStation publishes them.
