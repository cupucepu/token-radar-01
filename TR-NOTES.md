# Token Radar — TR-NOTES (model radar-2)

Entry built 15 Nov 2026 in `entry/`. Deadline 2026-12-14 10:00 UTC. Rewards: 1st
$1,000; 2nd–5th $50; 6th–10th $25. At most 5 submissions/day, 10 in all.

## The snapshot (read first)

- 758 protocols, `as_of` 2026-11-14, floor $50,000,000, watchlist 40.
- Pre-token total: 342. Excluded by the watchlist rule: CEX 42, versioned names 11,
  excluded categories (Bridge / Canonical Bridge / Liquid Staking / Liquid Restaking /
  Restaked BTC) 86, wrapped/staked/staking words 5, exchange prefixes 0.
- Rankable total: 198 = 40 watchlist + 138 below the floor + 20 above the floor that
  the house's watchlist leaves out. Those 20 are described only as not in the sealed
  watchlist (Sentora Curator $2.76B, CIAN Yield Layer, Mellow Core, Circle Gateway);
  the snapshot's ten fields do not carry `parentProtocol`, so no parent-token reason
  can be stated for them, and they are NOT ranked. The brief's "~250–300 rows" estimate was wrong; the
  real board is 178 rows (40 + 138), which still clears the gate's 100-row minimum.
- Growth range in the rankable set: -72.7% to +4,448.5% (one extreme outlier).
  Change_7d null in 2 pre-token protocols; listed_at null in 7 rankable ones.
- Category launch rates (live / (live + pre), counted from the snapshot): Risk
  Curators 0.13, Onchain Capital Allocator 0.31, Dexs 0.74, Lending 0.79, global 0.549.
  30 categories appear on the board; Risk Curators is the largest (34 rows).

## Model radar-2 — design rationale

```
base     = $120M x log10(1 + tvl / $10M)
growthM  = 1 + clamp(change_7d, -60, +200) / 100 x 1.00
maturity = 0.75 + min(age, 1095) / 1095 x 0.25
chainsM  = 1 + 0.015 x min(chains - 1, 10)
catM     = 0.85 + launchRate(category) x 0.30
implied  = max(1, round(base x growthM x maturity x chainsM x catM))
```

- **Log base, not linear.** The starter's linear TVL x 0.25 makes the board almost
  purely TVL-ordered (its top 10 is the TVL top 10). Log-dampening gives a $2.75B
  protocol ~3.14x a $50M one, not 55x. A token launch is not worth 55x more just
  because the vault is 55x bigger.
- **Growth weight 1.00 with clamp [-60, +200].** Strong enough to actually move ranks:
  a $100M protocol growing +150% outranks a flat $1B protocol (verified in tests).
  The clamp stops one wild week from deciding a rank — without it, the +4,448%
  outlier would score ~45x and land at rank 1 with a ~$4B implied value, which would
  be indefensible. With the clamp it is 3x.
- **Maturity 0.75–1.00x over 3 years.** Age is the best record of how long a protocol
  has run with no token. Unknown age counts as 365 days (0.83x).
- **Chains +1.5% each, capped at 10.** Small, honest, capped.
- **Category factor from the snapshot itself.** launchRate(category) is counted at run
  time from live vs pre-token counts per category; categories with <3 protocols use
  the global rate (0.549). No name is special-cased anywhere; the same function scores
  every row. The dashboard and README state every constant.

## Board vs the starter (run once into scratch/starter-out for comparison)

- Starter: 200 rows (40 watchlist + 160 early by TVL), implied $543.6M → $1.1M.
  Its top 10 is the TVL top 10. Its early rows include 39 protocols radar-2 drops:
  bridges, canonical bridges, liquid-staking / restaking products and staked-word
  names (e.g. Bitget SOL, STKESOL, Mantle Restaking, Ink Bridge, SuiBridge) — products
  of tokens that already trade, not protocols waiting on a launch.
- Radar-2: 178 rows, implied $255.9M → $12.0M, all 178 implied values distinct,
  0 adjacent ties. Watchlist 40/40. Live view: 24 rows at market caps, none ranked.
- Rank movement on the 161 shared slugs: median |Δrank| = 14; 96 moved ≥10 places,
  72 moved ≥20, only 5 unchanged. Biggest risers: Monolith Market 165 → 70, NUVA
  101 → 27, Theo Network thBill 120 → 49, Manifest Trade 142 → 75. Biggest faller:
  Anemoy Capital 98 → 145 (old, flat, single-chain).
- Top 10: ranks 1–3 unchanged (Steakhouse Financial, Gauntlet, Veda — too big to move),
  but Upshift 5 → 4, Shift DeFi 35 → 6 (the +4,448% grower, clamped to 3x), OpenTrade
  10 → 8, Plume Vaults 12 → 9. Nonce Capital falls 6 → 18 (large but flat and young).
- Known judgment call: Shift DeFi at rank 6 on a $50M TVL is the model's loudest
  claim. It is the direct consequence of the growth term doing what the brief asks
  (growth moves ranks); the clamp is what keeps it at 3x instead of 45x.

## Verification — triple validation, all run 15 Nov 2026

### Round 1 — functional (PASS)
- `main.ts` run TWICE with the kit snapshot into scratch/out1 and scratch/out2:
  byte-identical outputs (`diff -r` clean). 178 rows (138 early, 24 live set aside).
- `scratch/check-gate.mjs` (all 7 gate rows + 4 extra checks): **11/11 PASS**.
  dashboard_files (3 files, 38,186 bytes), board_file (178 rows, 265,877 bytes),
  sorted_by_value (ranks 1..178, $255.9M → $12.0M), coverage 40/40, farm_steps
  (178 x 6, all 20..600 chars), screenshots (3 images), dossier_matches
  (272,364 bytes, byte-identical to buildDossier), exclusion_proof (0 violations),
  dashboard_source_cap (38,186 ≤ 60,000), page_board_agreement (data.js matches
  board.json; page recompute matches exactly), live_view (24 rows, all with mcap).
- Dossier text is 38,450 bytes: all three dashboard source files included whole
  (under the 65,536 cap). Board 265,877 bytes (under 8 MiB). Dossier 272,364 bytes
  (under 1.5 MiB). Zero `http`/`https` strings in any dashboard file.

### Round 2 — adversarial (PASS, 37/37)
`scratch/test-adversarial.mjs`: null growth → 0; growth clamps (+4,448% → +200%,
-72.7% → -60%); null/bad/future listed_at; 0 and 45 chains; tiny and null categories
fall back to the global rate; all 16 synthetic exclusion cases (CEX, Bridge, Liquid
Staking, Liquid Restaking, Restaked BTC, Canonical Bridge, V2 / 2.0 / v3 names,
wrapped / staked / staking words, Binance / Coinbase prefixes, live token) behave;
board-level facts (178 rows, 178 distinct implied values, 0 adjacent ties, farm
steps 124–175 chars, 30 categories); farm steps for no-chain, null-category and
2,000-day-old protocols; log-base ratio 3.14x ($2.75B vs $50M); growth outranks size.

### Round 3 — independent (PASS)
- Re-read the gate's 7 rows and the judge's 5 criteria against the built entry:
  (1) working radar — 40/40 coverage, pre-token ranked by stated implied value,
  page recompute matches the board exactly; (2) value model — follows only from
  snapshot figures (TVL, growth, age, chains, snapshot-counted category rate), no
  hardcoded names, live-token set aside; (3) farm plans — 6 concrete steps per
  protocol, each with a cost and a time; (4) dashboard — sortable on 6 keys,
  filterable by search / category / chain, detail view for every protocol;
  (5) looks made — own dark console theme, amber accent, consistent spacing,
  readable type, no framework.
- `scratch/smoke-dom.mjs` (page smoke test against a minimal DOM stub): **9/9 PASS**.
  Board 178 rows, live tab 24 rows, Dexs filter 20 rows, chain filter (Base) 35 rows,
  search "steakhouse" 1 row, detail dialog opens with breakdown + farm plan, empty
  filter renders the empty state without crashing. `node --check` on app.js passes;
  CSS braces balanced (104/104).
- One real bug found and fixed during verification: the page's recompute landed
  $443 off the board on Steakhouse Financial because the category launch rate was
  rounded to 4 decimals in data.js. Fixed by carrying full-precision multipliers and
  rates in `radarRow()` (board.json keeps the same full-precision audit copy); the
  page now recomputes every row exactly.

## What is still pending (NOT done — parent's steps)

1. **Real screenshots.** `entry/screenshots/` is EMPTY by design. This VM has no
   headless browser, so no screenshots were taken here and none were faked. For
   local verification only, 3 temporary valid PNGs (1280x800, generated with node
   zlib) live in `scratch/pngs/` and were used in `scratch/entry-test/` runs; they
   are NOT in the entry. The parent must open the built dashboard
   (`scratch/out1/dashboard/index.html` with `scratch/out1/data.js` beside it),
   capture the board, a protocol detail view and a filtered view at 300–350 KB
   each (long side ≤1440, short side ≥800), and place them in `entry/screenshots/`
   as `1-board.png`, `2-detail.png`, `3-filtered.png`. Then re-run main.ts and the
   gate check.
2. **Kit check + push + submit.** No push, no submit, no sign, no bundle was done
   by this session. The parent runs `node cli/makefun.mjs check`, pushes the repo,
   bundles this session's transcripts, and submits only with the user's explicit
   approval (standing rule: fix first, never submit carelessly).
3. **Authorship note.** All entry files were written in this session by Write/Edit
   (main.ts, lib/model.ts, dashboard files, README.md, TR-NOTES.md); vendor/
   makefun-board.ts and LICENSE were copied unchanged from the starter as instructed
   (vendored library / license, not authored code). model.ts and README.md were each
   revised in multiple messages, so the revised check is met.
