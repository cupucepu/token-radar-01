# Token Radar — TR-NOTES-v4 (model radar-4)

Entry built 17 Nov 2026 in `radar-4/entry/` (a copy of `radar-3-clone/`; the radar-3
files are untouched). Deadline 2026-12-14 10:00 UTC. Slots used: radar-2, radar-3
(2 of 10); 8 left. NO push, NO bundle, NO sign, NO submit from this session — the
user decides on submit, and only if 90% sure of the leaderboard.

Radar-4 is a rework of radar-3 ordered by the user ("agent radar kerja ulang juga
pake beberapa agent untuk kerja biar lebih bagus"), built from the parallel
diagnosis agent's ranked fix list (`radar-analysis/DIAGNOSIS.md`). Radar-3 graded
89.1% win rate (12W 0D 0L) and sits far from the top-40 shortlist (line 95.31%).
It lost NO games — the loss is in MARGINS, so these fixes target margins: the
out-of-sample evidence, the netted farm plans, and the coverage disclosure.

## 0. Definitions — the new terms, before the implementation

### Out-of-sample (leave-one-out + forward test)
Two held-out tests of the fitted base, computed by the entry at run time from the
snapshot, never hardcoded:
- **Leave-one-out (LOO).** Hold each live token out in turn, refit on the rest
  (levels refit per fold for the aligned sample, pooled only for the full sample),
  predict the held-out token. Scored as R² against the mean of the held-out actuals
  (it can go negative), median and mean |error| in log10 market-cap units, the
  share within a factor of two (|error| ≤ log10 2), and the typical factor
  10^median. A fold whose refit fails is skipped, and the score says how many folds
  it rests on.
- **TVL-split forward test.** Sort the live sample by TVL, split into halves, fit
  on the smaller-TV half and predict the larger half, then reverse. Levels are
  refit on the TRAIN half only, so a half with no category at n≥10 runs without
  levels — the test then measures the pooled power law, and this note says so.
  A forward test is harsher than LOO: it asks whether the fit extrapolates across
  the TVL range, not just across neighbouring points.

### Farm net and verdict
The farm plan's net, from the plan's OWN numbers: the assumed 4% yield on the
capital over the hold, minus the setup gas from step 2 ($8/$4 on Ethereum by the
$150-capital rule, $0.10 elsewhere — the number behind "a few cents") plus $2 of
gas a week over the hold (exact hold/7 weeks). Break-even APY is the APY the
position would need to earn for the assumed yield to cover the gas:
`gas / capital x 365 / hold x 100%`. Verdicts: **farm** at 100% break-even or less,
**thin** at 200% or less, **skip** above that. At the assumed 4% every plan nets
negative on yield alone, so the verdict is about relative cost, not profit: the
farm is a bet on the token, not on the yield.

### Excluded-20 disclosure
The 20 rankable protocols above the $50M floor that are not in the sealed
watchlist, each with the implied value it WOULD carry under the same model. The
reason for every row is the same: the coverage rule (watchlist + rankable below
the floor) leaves it out. No other reason is claimed — the snapshot cannot prove
why the house left any one of them out.

### Local-metric vs judge-score differences
Same rule as v2 §0: the entry's local numbers — gate checks, R², LOO/forward
scores, rank movements, determinism, reverse-test errors — measure internal
consistency and reproducibility ONLY. The judge scores the entry against its 5
published criteria by comparing two entries; a local metric is not a judge score,
does not predict it, and is never presented as one. The Judge Review Guide states
this explicitly on the page. **There is no local grade of this competition**: the
kit carries no grade-local and no judge/ or ladder/ trees (verified — the kit CLI
has login/register/merge/check/bundle/submit only), so radar-4's win rate against
radar-3 CANNOT be measured offline. What this note reports instead is the gate
record, the out-of-sample evidence, and the measured board difference.

## 1. Scope decisions (diagnosis fix list, in priority order)

- **(1) [C2, highest value] OOS test on the dashboard.** Done: LOO + forward test
  computed at run time in `fitCalibration`, both fits, displayed in the model
  panel (two rows) and interpreted in the validation panel. The aligned fit is
  KEPT as the base — see §5 for the corrected comparison.
- **(2) [C3] Net every farm plan + thin/skip verdict.** Done: net, break-even APY
  and verdict in every plan's yield step, from the plan's own numbers; verdict
  counts in the model panel note (4 farm, 23 thin, 151 skip).
- **(3) [C1] Disclose the 20 excluded above-floor protocols.** Done first, as
  ordered: a section in the model panel lists all 20 with TVL and would-be implied
  value, plus the counts that would enter the top 10 (3) and top 40 (16).
- **(4) [C2] One-sentence launch-rate disclosure.** Done: in the model panel note
  — the rate counts a protocol as already-trading when it records a CoinGecko id
  or a symbol, even with no market cap (global 0.549 vs 0.190 market-cap-only).
- **(5) Re-test the base choice by OOS performance after 1–4.** Done: §5. No
  out-of-sample test gives the all-rows fit a significant advantage; aligned stays.
- **NOT changed, as ordered:** the power-law base, the growth clamp, maturity /
  chains / catM, the 8-step plan structure (net + verdict added inside step 4),
  C4/C5, the screenshots, the verification machinery (only path adaptations so the
  scripts run against this layout — see §4).
- **Rejected in research (rounds 2–3, carried over):** growth weight/cap variants
  do not improve separation (median adjacent gap 0.69–0.78% vs baseline 0.78%);
  the mcap-only launch rate churns the board (median |Δrank| 4, max 21) on an
  untestable definitional call — keep the current counting, disclose it (fix 4);
  level variants (min_n 8/9, k 20/25/30), Huber, trimmed, slope-shrink and the
  weighted fit give no clear LOO gain and churn ranks — not adopted. The 20
  above-floor protocols are NOT added to the board: several read as sub-products /
  wrapped products (USDCx, Circle Gateway, Polymarket International), and the
  coverage rule is the sealed watchlist's, not this entry's to rewrite.

## 2. Model radar-4 — what changed, what did not

### 2.1 Out-of-sample tests (`lib/model.ts`: `liveSamples`, `fitLevels`, `looFit`, `forwardOne`, `scoreOutOfSample`)
- `fitCalibration` now draws both live samples once (`liveSamples`) and shares
  them with the tests, so the out-of-sample tests judge the same samples the base
  is fitted to. The level computation is extracted into `fitLevels` with identical
  arithmetic; the full-sample a/b/R² are bit-identical to radar-3 (a=3.9077,
  b=0.4049, R²=0.1026, n=94; full a=3.0247, b=0.5223, R²=0.1939, n=128 — the
  gate's calibration check passes on the same tolerances).
- LOO is a true leave-one-out for BOTH samples: each held token is refit without
  it. The median uses the true median (mean of the two middle values for even n),
  not the upper-middle value `olsLog10` reports as `median_resid` — that number is
  displayed as-is and left untouched.
- Measured on this snapshot (TS build, cross-checked against Python in
  `scratch/experiments-v4d.py` and `experiments-v4e.py` — exact agreement):
  - LOO aligned (n=94): R²_loo 0.0593, median |err| 0.5623, mean 0.6603,
    within 2x 36.2%, typical error x3.65.
  - LOO all-rows (n=128): R²_loo 0.1703, median |err| 0.5313, mean 0.6931,
    within 2x 32.0%, typical error x3.40.
  - The two LOO scores are on DIFFERENT test sets — the all-rows set includes the
    34 excluded-category tokens, which the pooled line predicts better. The
    dashboard shows both n's beside both scores for exactly this reason.
  - Forward aligned (n=47/47, levels=0 in both halves — no category reaches n≥10
    in a 47-row half, so the test measures the pooled power law): small→large
    R² −0.0319, median 0.3676, mean 0.5901, within 2x 42.6%, typical x2.33;
    large→small R² −0.1302, median 0.5539, mean 0.7505, within 2x 27.7%, x3.58.
  - Forward all-rows (n=64/64): small→large R² −0.1186, median 0.7161, mean
    0.7772, within 2x 26.6%, x5.20; large→small R² +0.0271, median 0.5863, mean
    0.7105, within 2x 28.1%, x3.86.
  - The forward test is the honest bad news, and the dashboard states it: the fit
    does not extrapolate across the TVL range (R² below zero in 3 of 4 directions).
    The base is a rough calibration, not a law that extrapolates.
- **Correction to the diagnosis (important).** The diagnosis said "F tests better
  OOS, R²_loo 0.094 vs 0.059". That 0.094 was CONTAMINATED: the research script's
  M estimator ignored its `rows` argument and always fitted on all 128 live
  tokens, so each "held-out" point was in its own fit. The TS build does a true
  LOO (all-rows R²_loo 0.1703 on n=128). The fair comparison is on the SAME 94
  points (`scratch/experiments-v4e.py`): all-rows R²_loo 0.0691 vs aligned 0.0593,
  paired mean |err| difference +0.0044 log10 (se 0.0098, t=+0.45 — NOT
  significant), full better on 43/94 points, aligned better on 51/94. Mean |err|:
  aligned 0.6603 vs full 0.6647 (aligned slightly better); median: full 0.5313 vs
  aligned 0.5623 (full slightly better). No metric separates them significantly —
  so the base stays aligned on principle (fit the sample the board ranks), not on
  a claimed OOS win. The dashboard shows both LOO numbers; this note carries the
  same-94 correction.
- **Follow-up (17 Nov, after independent validation): the same-94 test is now on
  the dashboard too.** One row in the model panel, directly under the LOO row:
  "Paired test, same 94 points (aligned / all-rows) — R² 0.059 / 0.069, paired
  t=+0.45, not significant". It is a STATED measured value, not computed at run
  time: the paired t needs the per-point aligned LOO errors, and the runtime data
  carries no per-point category (cal.points are TVL/mcap pairs only), so a runtime
  recompute of the aligned side is not possible without changing the model — and
  the model is not changed for a display line. The numbers are the independently
  verified ones (validator's loo-check.py; VALIDATION.md fix 5), shown to three
  decimals so the small gap stays visible. Dashboard 52,733 → 53,062 B (+329 B,
  6,938 B headroom). Board values, farm plans and every other panel untouched.

### 2.2 Farm net + verdict (`farmPlanSummary`, `setupGasUsd`, `yieldFor`)
- Setup gas as a number mirrors step 2's words exactly: Ethereum $8 when the
  capital is $150 or more, $4 below it; every other first chain $0.10 (the number
  behind "a few cents"). Weekly gas $2/week over the hold, exact hold/7 weeks.
- The yield step now ends: "Netted: $X.XX of gas all in ($Y.YY to set up, $2 a
  week for N days); the yield nets -$Z.ZZ after gas and breaks even at B% a year.
  Verdict: farm/thin/skip -- <gloss>."
- Measured distribution over the 178 rows: net $ min −20.81, p25 −16.59, median
  −12.41, p75 −8.51, max −8.18 (all negative, as expected at the assumed 4%);
  break-even APY min 70%, p25 210%, median 211%, p75 211%, max 306%. The 211%
  cluster is the non-Ethereum $50 rows: weekly gas dominates and scales with the
  hold, so the break-even barely moves with hold length. Thresholds 100%/200% give
  4 farm / 23 thin / 151 skip.
- The diagnosis's five example plans under the built formula: $50/30d ETH
  −$12.41 / 306% (diagnosis −$12.44 / 307%); $50/60d −$20.81 / 257% (diagnosis
  −$20.87 / 258%); $100/45d −$16.36 / 137% (diagnosis −$16.31 / 136%); $150/45d
  −$20.12 / 113% (diagnosis −$16.06 / 91% — DIFFERS: the diagnosis used $4 setup
  for capital 150, but the plan's own step-2 text says $8 for capital ≥150; the
  built formula follows the plan's text); $250/60d −$23.50 / 61% (diagnosis
  −$23.56 / 61%). The ≤5¢ gaps elsewhere are the diagnosis rounding weeks to one
  decimal; the build uses exact hold/7. Longest step 4 is 509 chars (cap 600).

### 2.3 Excluded-20 disclosure (`excludedAboveFloor`)
- Computed in `buildRadar` with the same `impliedValue` as the board, sorted by
  would-be implied value. All 20, with TVL and would-be value (the build's numbers;
  the audit lists the same 20 by TVL):
  Sentora Curator $2.76B → $42,510,731; CIAN Yield Layer $280M → $22,439,176;
  Polymarket International $320M → $21,213,649; BitFi Basis $215M → $18,327,379;
  Defi Saver Asset Management $276M → $16,860,441; Mellow Core $233M →
  $15,408,472; Figure Markets Prime $191M → $14,234,029; Figure Markets Exchange
  $131M → $13,781,636; Extended Perps $96M → $12,351,030; Theo Network thUSD $139M
  → $12,290,102; IPOR Fusion $68M → $11,299,637; Avant avUSD $95M → $10,503,956;
  Circle Gateway $65M → $9,900,948; Stellar DeFi Hub $83M → $9,757,507; Solv
  Strategies $57M → $9,515,023; Nado Spot $51M → $9,511,307; AZverse Perps $52M →
  $8,831,929; USDCx $57M → $8,672,655; Arcus Perps $60M → $8,628,803; Loopscale
  Lending $71M → $8,149,223. 3 would enter the top 10 (top-10 line $18,329,722;
  BitFi at $18,327,379 sits $2,343 below it), 16 the top 40 (line $9,010,362);
  Sentora's $42.5M would be rank 2, not rank 1 — the board peak is $47,387,177.
- **Correction to the research script.** `experiments-v4d.py` built its category
  launch rates with the live/pre indices SWAPPED (it returned pre/total), so its
  excluded implied values were wrong (Sentora $53.2M). Fixed in
  `experiments-v4e.py`: 16/20 exact, 4 off by $1 (whole-dollar base rounding —
  Python uses the unrounded base, the build rounds it first). The TS build is
  authoritative; the audit script independently lists the same 20 slugs.

### 2.4 Launch-rate disclosure
- The model note now states: the rate counts a protocol as already-trading when it
  records a CoinGecko id or a symbol, even with no market cap — global 0.549
  (416/758) vs 0.190 market-cap-only (144/758 with a recorded market cap, including
  the 16 non-positive rows audit note (b) flags; strictly positive would be
  128/758 = 0.169 — the dashboard uses the audit's non-null definition, matching
  `audit-198.json`'s `global_launch_rate_mcap_only: 0.190`).
- The `ticker_no_mcap` count (272) was already displayed; the new sentence is the
  counting RULE and the contrast, not the count.

### 2.5 Farm-plan mirror deleted (dashboard byte budget)
- The page no longer regenerates the farm plan from the row's figures. The plan is
  written by `main.ts` into `data.js` beside each row (`RadarRow.farm_steps`), from
  the same `farmSteps` that writes `board.json`, and the detail view reads it from
  there. The mirror duplicated ~9.7 KB of template to prove the same strings; the
  dashboard was 2,456 B OVER the 60,000 B cap with the new panels added, and the
  brief explicitly invited this trade. The guarantee moves from the mirror to the
  check: `farm-sync-check.mjs` still verifies the dialog shows exactly the steps
  `board.json` carries on all 178 rows (178/178 PASS), and `check-gate` still
  verifies page/board agreement exactly on implied values. The guide's step 4
  ("the page recomputes the row") is about the implied-value recompute
  (`impliedOf`), which is untouched.
- `data.js` grows 107,247 → 502,912 B (the farm steps are carried, not generated);
  no gate row caps `data.js`, and it is not part of the dossier text.

## 3. Dashboard additions (byte budget)

| | radar-3 | radar-4 | delta |
|---|---|---|---|
| `app.js` | 48,587 | 42,515 | −6,072 |
| `app.css` | 9,855 | 9,724 | −131 (dead `.watch` rule removed) |
| `index.html` | 823 | 823 | 0 |
| **Dashboard total (cap 60,000)** | **59,265** | **53,062** | **−6,203** |
| Dossier text (cap 65,536) | 59,529 | 53,326 | −6,203 |
| `board.json` | 484,933 | 504,618 | +19,685 (longer step 4) |
| `data.js` | 107,247 | 502,912 | +395,665 (farm steps carried) |
| `dossier.json` (cap 1.5 MiB) | 1,101,857 | 1,095,554 | −6,303 |

New on the page: three out-of-sample rows in the model panel (LOO with both n's,
the same-94 paired test, forward test both directions), the forward-test sentence in the validation panel,
the launch-rate sentence + farm-verdict counts in the model note, and the
above-floor disclosure list in the model panel. The additions cost ~3,500 B; the
mirror deletion paid for them with 6,938 B of headroom to spare. The model panel's
sub paragraph lost one sentence (the levels sentence — the levels row's own label
already says "shrunk k=20, n≥10").

## 4. File-change log (every file changed, with its reason)

| File | Change |
|---|---|
| `entry/lib/model.ts` | Radar-4: `MODEL_VERSION` radar-4; `Calibration` gains `loo` + `forward`; `liveSamples` / `fitLevels` / `scoreOutOfSample` / `fitOneSample` / `looFit` / `forwardOne` (OOS at run time); `farmPlanSummary` / `setupGasUsd` + net/verdict in `yieldFor`; `excludedAboveFloor` + `ExcludedRow`; `RadarData` gains `excluded`, `excluded_top10/40`, `farm_verdicts`, `launch_rate_global`, `launch_rate_mcap_only`; `RadarRow` gains `farm_steps`; `buildRadar` computes all of it. Scoring model untouched — implied values bit-identical to radar-3. |
| `entry/main.ts` | Header comment: model radar-4. Nothing else. |
| `entry/dashboard/app.js` | Radar-4: LOO + forward rows, validation-panel forward sentence, model-note launch-rate sentence + verdict counts, above-floor disclosure list; farm-plan mirror DELETED (see §2.5), detail view reads `row.farm_steps`; dead `.watch` CSS removed from `app.css`. |
| `entry/dashboard/app.css` | Dead `.watch` rule removed (0 uses). Nothing else. |
| `entry/README.md` | Rewritten for radar-4: OOS numbers, farm net/verdict, excluded-20 disclosure, launch-rate sentence, mirror-deletion note, dashboard 52,733 B, screenshots-stale note. Badges now point at repo `cupucepu/token-radar-01` per the build brief (radar-3's README used `cupucepu/make-fun-token-radar`). |
| `entry/TR-NOTES-v4.md` | This file. |
| `entry/screenshots/` | Copied byte-for-byte from radar-3-clone (verified-current radar-3 shots). NOT re-taken — see §7. |
| `scratch/check-gate.mjs`, `farm-sync-check.mjs`, `smoke-dom.mjs`, `reverse-test.mjs`, `test-adversarial.mjs`, `audit-198.mjs` | Path adaptations ONLY so the scripts run against this layout (`entry-v2/` → `entry/`, `scratch-v2/out1` → `scratch/out1`, snapshot path `../token-radar-01-kit/...`). No check logic changed. Their usage comments still say `scratch-v2` in places — comments only. |
| `scratch/estimator-v4.py`, `experiments-v4b.py`, `experiments-v4c.py` | Research (rounds 1–3): LOO estimator comparison, growth/launch-rate/198 simulations. |
| `scratch/experiments-v4d.py`, `experiments-v4e.py` | Research (rounds 4–5): forward test, farm-net distribution, excluded-20; v4e corrects v4d's swapped launch rate and the contaminated M-LOO. |
| `scratch/radar3-out/` | Baseline radar-3 build (for the §5 diff). Not part of the entry. |
| `scratch/out1/`, `scratch/out2/` | Two radar-4 builds (determinism pair). Not part of the entry. |
| `scratch/audit-198.json` | Audit output (198 = 178 + 20). |

## 5. Board: radar-4 vs radar-3 (measured, not assumed)

- Implied values: **0 diffs on 178 rows**; ranks identical; peak $47,387,177 and
  floor $2,598,523 unchanged. The scoring model did not change, so no row moved.
- Farm steps: **only step 4 (index 3, the yield step) changed, on all 178 rows**
  (net + break-even + verdict added). Steps 1–3 and 5–8 are byte-identical to
  radar-3 on every row. Longest step is now a netted yield step at 509 chars
  (radar-3's longest was 398), cap 600.
- Calibration: bit-identical (a=3.9077, b=0.4049, R²=0.1026, n=94; full
  a=3.0247, b=0.5223, R²=0.1939, n=128; levels Lending 0.77x n=15, Dexs 1.03x
  n=11; points identical).
- **Base-choice re-test (fix 5).** LOO on the same 94 points: aligned R² 0.0593 vs
  all-rows 0.0691, paired t=+0.45 (not significant); forward test: aligned wins
  small→large on R² (−0.03 vs −0.12) and median error (0.368 vs 0.716) in both
  directions on median, loses large→small on R² (−0.13 vs +0.03). No test
  separates the fits significantly. Aligned stays: it is the sample the board
  ranks, and the choice is now displayed with its evidence instead of asserted.
- **Win rate: NOT measured.** No local judge ladder exists in the kit, so no
  offline win rate vs radar-3's 89.1% can be quoted. The honest statement is the
  evidence above plus the gate record in §6: the fixes target the margins radar-3
  lost on (OOS evidence a judge can check, netted plans with verdicts, the
  coverage disclosure), not the win column (radar-3 already won 12/12).

## 6. Verification record (actual outputs)

### Round 1 — functional (L2 board + determinism), 17 Nov 2026
`main.ts` run twice into `scratch/out1` and `scratch/out2`: byte-identical
(`diff -r` clean). `check-gate.mjs` 14/14 PASS: dashboard_files (3 files, 52,733
B), board_file (178 rows), sorted_by_value (ranks 1..178, $47,387,177 →
$2,598,523), coverage (40/40), farm_steps (178×8, 20..600 chars), screenshots (3
images — STALE radar-3 shots, gate row passes on file validity only),
dossier_matches (1,095,222 B, byte-identical to buildDossier, text 52,997 B),
exclusion_proof, dashboard_source_cap (52,733 ≤ 60,000),
page_board_agreement_exact (178 rows, recompute EXACT), live_view (24 rows),
full_precision_recompute_within_$1 (worst $1), calibration (a/b/R² as above),
invalid_growth_flags (estate-protocol, swan-dao).

### Round 3 — same-94 paired-test row on the dashboard, 17 Nov 2026
One line added to `entry/dashboard/app.js` (model panel, under the LOO row):
"Paired test, same 94 points (aligned / all-rows) — R² 0.059 / 0.069, paired
t=+0.45, not significant" (stated measured value; see §2.1 for why it is not
runtime-computed). `main.ts` re-run twice into `scratch/out1` and `scratch/out2`:
byte-identical (`diff -r` clean). `check-gate.mjs` 14/14 PASS on the fresh build:
dashboard 53,062 B (cap 60,000), dossier text 53,326 B (cap 65,536).
`farm-sync-check` PASS (178/178), `smoke-dom` 17/17 PASS, `reverse-test` ALL ROWS
INVERT WITHIN TOLERANCE (worst 0.000029% / 0.000066%), `render-check` 9/9 PASS,
`test-adversarial` ALL PASS. Board and data unchanged by the edit: board.json and
data.js sha256 identical to the Round 1 build (board 18473655…e176d, data
df82cb4f…e3ba37); only dossier.json changed (it embeds the dashboard source).
Paired-row render check (`/tmp/paired-row-check.mjs`, smoke-dom stub): label,
values, t and verdict all render; LOO row still renders beside it. Screenshots
still radar-3's — re-take from the built radar-4 page still required before any
submit.

### Round 2 — adversarial (L1 unit + reverse test)
`test-adversarial.mjs`: ALL PASS (edge cases: null growth, clamps, spike
confidence, null age, 0/45 chains, tiny/null categories, all six exclusion rules,
calibration status, degenerate snapshot FAILED, 16 non-positive mcap rows
excluded, 178 distinct implied values, 0 adjacent ties, farm-step bounds, levels
exact). `reverse-test.mjs`: all 178 rows invert within tolerance — worst
from-base 0.000029%, worst from-implied 0.000066% (granite), tolerance 0.1%.
`audit-198.mjs`: COUNTS AGREE — rankable 198 = board 178 + above-floor 20;
rankable above floor 60 = in watchlist 40 + not in watchlist 20; audit note (a)
272 ticker-no-mcap, global launch rate 0.549 vs 0.190 mcap-only; note (b) 16
non-positive mcap rows excluded from the fit.

### Round 3 — render (L3) + farm sync
`smoke-dom.mjs`: 17/17 PASS (board 178 rows, 8 shell sections, compare view,
guide, model panel names both fits, invalid-growth badges 2, spike badges 3,
live tab 24 rows, Dexs filter 20, Base filter 35, search "steakhouse" 1 row,
detail dialog opens with breakdown + farm plan + recompute line + 8 steps,
invalid-growth flag, empty state).
`farm-sync-check.mjs`: PASS — guide step 3 states the measured inversion results
(0.000029% / 0.000066%), no run-it-yourself wording, page farm plan matches
board.json on 178/178 rows exact.

### Gitleaks
`gitleaks detect --source entry/ --no-git`: no leaks found (211,918 B scanned).

## 7. Open items / blockers

- **Screenshots are STALE and must be re-taken.** `entry/screenshots/` holds the
  three radar-3 shots, verified current for radar-3. They do NOT show the radar-4
  dashboard: the leave-one-out rows, the forward-test row, the above-floor
  disclosure and the netted farm plans are not in them. The gate's screenshots
  row passes on file validity only, so criterion 1 (screenshots agree with the
  code) fails until they are re-taken from the built radar-4 page. Re-take needs
  a browser (none works on this VM — Chromium refuses to start under the Hatch
  WebGL domain policy); flag for the parent's browser task. Do not edit the
  dashboard after the photos are taken.
- **No local judge ladder.** The win rate vs radar-3 cannot be measured offline
  (§0). Submit only if 90% sure of the leaderboard, per the user rule — this
  round is offline improvement only, no submit.
- **Forward test is weak by construction.** The 47-row halves earn no category
  levels, so the forward test measures the pooled power law only. A stronger
  forward test would need a bigger live sample than this snapshot carries.
- **The $150-capital setup-gas boundary.** The built net uses $8 for capital ≥150
  (the plan's step-2 text); the diagnosis's example used $4 for capital 150.
  If the step-2 text ever changes, the net follows it — they share the rule.
