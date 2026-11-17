# Token Radar — TR-NOTES-v2 (model radar-3)

Entry built 16 Nov 2026 in `entry-v2/` (a copy of `entry/`; the submitted radar-2 files
in `entry/` are untouched). Deadline 2026-12-14 10:00 UTC. Slot 1 of 10 used (radar-2).
NO push, NO bundle, NO sign, NO submit from this session — the user decides on submit.

## 0. Locked spec — definitions first (parent order 12:31 WITA)

The locked spec used three terms that appear in neither v1 nor Claude's first answer.
Each is defined here, concretely, BEFORE it is implemented. If a definition below
cannot be implemented exactly as written, the item is left out and the report says so.

### Judge Review Guide
A neutral section in the dashboard (and mirrored in `README.md`) that tells a judge
exactly how to verify this entry, step by step, without arguing for a score:
1. Re-run `main.ts` twice into two directories and diff them — the outputs are
   byte-identical (determinism).
2. Check `board.json`: 178 rows, ranks exactly 1..178, watchlist 40/40, implied
   values positive whole dollars, non-increasing, not all equal.
3. Run the reverse test (defined below): invert the formula per row to recover TVL.
4. Open any row's detail view and read the recompute line — the page recomputes the
   row from its own figures and states whether it matches `board.json`.
5. Read the local-metrics note (defined below).
Neutral means verification steps only: no superlatives, no score claims, no "best".

### Nested validation
Validation at three nested layers of the pipeline; each layer checks the output of
the layer inside it, so a failure at L1 invalidates L2 and L3:
- **L1 unit** — the model's arithmetic (`impliedValue`, `fitCalibration`,
  `farmSteps`, `isRankable`) against synthetic edge cases and the real snapshot.
  Run by `scratch-v2/test-adversarial.mjs`.
- **L2 board** — the built artifacts (`board.json`, `data.js`, `dossier.json`,
  `dashboard/`, `screenshots/`) against the 7 gate rows from RULES.txt plus the
  entry's own stricter checks (exclusion proof, source cap, page/board agreement,
  live view, calibration status, invalid-growth flags).
  Run by `scratch-v2/check-gate.mjs`.
- **L3 render** — the page as the judge sees it: `app.js` run against a DOM stub
  from the built `data.js`, exercising the board, live tab, filters, sort, detail
  dialog, compare view, empty state.
  Run by `scratch-v2/smoke-dom.mjs`.
This is v1's triple validation (functional / adversarial / DOM smoke), now named
and layered so a failure can be located to a layer.

### Reverse test
For every board row, invert the scoring formula using ONLY the row's stored figures
to recover its input TVL, and require the recovered TVL to match the row's `tvl_usd`
within 0.1% (relative). Two inversions, both must pass:
- From the stored base: the base is the fitted power law `base = 10^a_eff x tvl^b`, so
  `tvl = (base_usd / 10^a_eff)^(1/b)` with the row's stored effective intercept
  (`a_eff`: the category level when earned, else the pooled `a`) and the pooled `b`.
- From the implied value via the stored multipliers:
  `base = implied / (growth x maturity x chain x category)`, then the same inversion.
If any row's value were hand-edited inconsistently, or a multiplier rounded in storage, the
inversion would not recover the TVL. This is a stored-figures consistency test, not a proof
that no number was hand-set: a hand-edited multiplier+implied pair would still invert, because
the inversion uses the stored multipliers. The proof that the numbers follow from the snapshot
is the independent recompute from the snapshot's own fields (TVL, growth, age, chains, category,
base rounded first), which matches the board's implied value on 178/178 rows with $0 difference.
The Judge Review Guide states the measured inversion results on the page (step 3) instead of
asking the judge to run the script, which is not in the bundle.
(The stored `base_usd` is rounded to whole dollars, and the implied value is
scored from that rounded base; the rounding moves the recovered TVL by ~1e-8
relative, far inside the 0.1% tolerance. Multipliers are stored at full
precision — see the $443 Steakhouse rounding lesson in v1.)
Measured on this build: worst from-base error 0.000029%, worst from-implied
error 0.000066% — both far inside 0.1% (run by `scratch-v2/reverse-test.mjs`).

### Local-metric vs judge-score differences
The entry's local numbers — gate checks, R², rank movements, determinism,
reverse-test errors — measure internal consistency and reproducibility ONLY. The
judge scores the entry against its 5 published criteria by comparing two entries;
a local metric is not a judge score, does not predict it, and is never presented
as one. The Judge Review Guide states this explicitly on the page.

## 1. Scope decisions (parent flags, 12:29–12:31 WITA)

- **Keep radar-2's verified-good parts except the base.** Maturity (0.75–1.00x
  over 1095d), chains (+0.015 each, cap 10), category (0.85 + launchRate x 0.30)
  are unchanged in form and constants — triple-validated, small ranges. The base
  is the one part that changed (see the 12:37 decision below): radar-2's log base
  (`$120M x log10(1 + tvl / $10M)`) is GONE. Change ONLY the weak parts: growth
  dominance + spike confidence (step 1), the base itself (step 2), farm-plan
  templates (step 3). No rebuild from scratch.
- **12:37 WITA parent decision — the power law IS the base (this supersedes the
  12:29 "keep the log base" direction).** The build first implemented the
  regression as the base while the comments still said "log base kept / fit is a
  cross-check" — a real comments-vs-code contradiction the parent verified on
  disk (`impliedValue` used the fitted power law while `base_scale`/`base_ref`
  sat dead in the constants). Decision: KEEP THE CODE, rewrite the words. The
  base is the fitted power law `10^a x tvl^b` with the ALIGNED fit's a and b,
  honestly including that the fit is weak (R² 0.10 aligned, 0.19 unaligned).
  `base_scale`/`base_ref` were REMOVED from the model constants and from
  `data.js` entirely (verified: `app.js` never read them, `index.html` and
  `README.md` never referenced them). Header, interface comment, README and every
  dashboard text now describe the power law as THE base.
- **Regression is the base, not a display.** The aligned fit (n=94, live tokens
  in rankable categories) scores every row. The unaligned fit (n=128, all live
  tokens) is shown beside it in the dashboard's validation panel and model panel
  as the disclosed comparison, so the choice of sample is visible, not hidden.
  The "regression-base variant was measured and rejected" paragraph from the
  earlier draft is withdrawn: the power law was not rejected, it became the
  model, and the numbers it produces are the board's numbers in §5.
- **Parent flag correction — a regression DOES exist in `entry-v2/lib/model.ts`.**
  The 12:31 flag said grep finds no regression, only the radar-2 log base. The
  file in front of me has `fitCalibration` at line 140 (natural-log OLS, written
  earlier in this session). The flag is inconsistent with the file state. Resolution:
  `fitCalibration` was rewritten fresh as log10 OLS with validation and a FAILED
  status (same function name, new body and interface), per the locked spec's
  substance (OLS on log10, min_n = 30, validated, no fallback). No code was copied
  from the old body; the new body is written in this session.
- **No radar-4 exists.** The folders are `entry/` (radar-2, SUBMITTED — DO NOT
  TOUCH) and `entry-v2/` (radar-3, this build). All work stays in `entry-v2/`.
- **Board stays 178 rows; 198 is the audit universe.** Board = 40 watchlist +
  138 rankable below the $50M floor. The 20 rankable protocols above the floor
  stay EXCLUDED (the snapshot carries no `parentProtocol` field among its ten fields, so no
  parent-token reason can be stated for them). The audit (`scratch-v2/audit-198.mjs`) covers all
  198 rankable protocols: the 178 on the board plus the 20 excluded, each described only as
  "not in the sealed watchlist". The board is NOT expanded to 198 rows.
- **"58% dossier reduction" NOT applied.** The spec never names what is reduced by
  58%. No safe, specific reduction was identified, so nothing was cut. The dossier
  stays complete and within caps (dashboard source ≤ 60,000 B; dossier text
  ≤ 65,536 B; dossier file ≤ 1.5 MiB). Measured sizes are in §6.
- **Invalid rows (null `change_7d`).** 4 in the snapshot (contango-v2,
  estate-protocol, kinetiq-elysium-bridge, swan-dao). 0 of the 128 all-live
  regression rows have null growth, so the invalid-row exclusion removes 0 rows
  from the fit — but the filter now excludes null-growth rows explicitly, so the
  rule is enforced in code (stated, not hidden). The ALIGNED fit sample is n=94:
  the 128 all-live rows minus the 34 live rows in the board's excluded
  categories (CEX / Bridge / Canonical Bridge / Liquid Staking / Liquid
  Restaking / Restaked BTC). On the board, 2 rows have null growth
  (estate-protocol, swan-dao): each gets M_g = 1.0, an invalid flag in the data,
  and a "growth unreported" badge on the board + a line in the detail view.
  Invalid rows are never counted as valid observations in regression evaluation
  or model-quality claims.
- **"New folder" = `scratch-v2/`.** Audit outputs and adapted verification scripts
  live outside `entry-v2/`, so nothing extra can be swept into the submission
  bundle (which copies only `dashboard/` and `screenshots/`).

## 2. Model radar-3 — what changed, what did not

```
base     = 10^a_eff x tvl^b, log10 OLS fitted at run time
           ALIGNED (the model): a = 3.9077, b = 0.4049, R2 = 0.1026, n = 94
           (live tokens in rankable categories only)
           a_eff is the category's shrunk level when earned (Lending 0.77x,
           Dexs 1.03x; n≥10, k=20), else the pooled a; slope b pooled always.
           UNALIGNED (disclosed comparison): a = 3.0247, b = 0.5223,
           R2 = 0.1939, n = 128 (all live tokens)
           The base is rounded to whole dollars FIRST and the implied value is
           scored from that rounded base, so board, data.js and the page all use
           the same number (see the $1 note in §2 below). a and b stay full
           precision in data.js.
growthM  = 1 + clamp(change_7d, -40, +100) x confidence / 100 x 0.50
           confidence = min(1, tvl_prev / $5,000,000), tvl_prev = tvl / (1 + g/100)
           null change_7d -> M_g = 1.0 + invalid flag
maturity = 0.75 + min(age, 1095) / 1095 x 0.25        -- UNCHANGED
chainsM  = 1 + 0.015 x min(chains - 1, 10)            -- UNCHANGED
catM     = 0.85 + launchRate(category) x 0.30         -- UNCHANGED
implied  = max(1, round(base x growthM x maturity x chainsM x catM))
```

- **Base (step 2, the 12:37 decision).** The fitted power law IS the base — it
  scores every row. The aligned fit is the model because the fit sample must
  match the board's exclusion rules: CEX / Bridge / Canonical Bridge / Liquid
  Staking / Liquid Restaking / Restaked BTC live rows are left out (34 rows).
  The unaligned fit over all 128 live tokens is reported beside it (dashboard
  validation panel + model panel + §5) so the sample choice is visible. The fit
  is weak — R² 0.10 aligned, 0.19 unaligned, median residual ~3.5x — and the
  dashboard says so in plain text; the base is a rough calibration, not a
  precise law. Radar-2's log base (`$120M x log10(1 + tvl / $10M)`) and its
  constants `base_scale`/`base_ref` are gone from the model, the data and the
  dashboard.
- **Category levels — level, not slope (Round 5, 16 Nov 2026).** The pooled fit
  explains only 10% of live-token market-cap variance, and the mcap/TVL
  relationship is category-specific: within-category univariate R² is Lending
  0.37 (n=15), Dexs 0.32 (n=11), Yield 0.21 (n=9), RWA 0.50 (n=9), against
  pooled 0.10. So categories with enough live rows earn their own intercept —
  but ONLY the intercept, and ONLY with strong shrinkage:
  `a_eff = A + (n/(n+20)) x (a_cat - A)`, where `a_cat` is the category's mean
  `log10(mcap) - b x log10(tvl)` at the pooled slope b=0.4049. Only Lending
  (n=15, a_cat=3.643, raw 0.54x → shrunk a_eff=3.794, 0.77x) and Dexs (n=11,
  a_cat=3.941, raw 1.08x → shrunk a_eff=3.920, 1.03x) qualify (n≥10). Every
  other category uses the pooled intercept — Yield and RWA (n=9 each) stay
  pooled (shrunk they would be 0.79x / 1.08x; reported as a sensitivity note,
  not applied). The SLOPE stays pooled for every row, so the base stays concave
  and cannot explode at large TVL. The category multiplier (catM) is untouched:
  it measures launch propensity (share of a category that already trades a
  token), a different signal from value-per-TVL. The dashboard discloses the
  levels (model-panel consts row with n) and each row's effective intercept
  (detail view shows `10^a_eff`, with the level named when it differs from
  pooled). The calibration object carries the levels (`category, n, a_cat,
  a_eff, level`) so the display is data, not hand-typed text.
  - *Rejected, with numbers.* Per-category SLOPES: Dexs b=1.78, Lending b=1.50
    — simulated top value $1,086,358,678 (Bittensor dTAO, was $18.9M). Absurd,
    never shipped. Intercept-only with WEAK shrinkage (k=10): single-token
    categories (raw level up to 567x, Prediction Market) move rows up to 73
    ranks, median |Δrank| 19. Overfitting, never shipped. The chosen design
    (n≥10, k=20, slope pooled) moves no row by more than 25 ranks — measured
    in §6 Round 5.
- **The $1 rounding note (12:44 correction, verified by measurement).** The
  stored `base_usd` is rounded to whole dollars, identically in `board.json`
  and `data.js`. The 12:44 steer said whole-dollar rounding already gives a
  0/178 page/board miss — that was measured on a build where the page
  recomputed the base from the full-precision formula, so the board and the
  page both used the unrounded base. With `impliedOf` reading the STORED
  rounded base (the current page), the board must score from the same rounded
  base or the two disagree: my check-gate found exactly one $1 miss (upshift:
  page $27,686,836 vs board $27,686,835) when the board still scored from the
  unrounded fit. Fix: `impliedValue` rounds the base FIRST and scores the
  implied from that rounded base — 36 of 178 rows' implied values move by $1
  (upshift is now $27,686,836), no rank changes (minimum adjacent implied gap
  is $756), and the page recompute now matches the board exactly on all 178
  rows. An independent full-precision recompute from the dashboard's a/b may
  differ by at most $1 per row — verified by the gate (worst $1, 36 rows).

- **Growth (step 1).** Weight 1.0 → 0.5, clamp [-60, +200] → [-40, +100].
  Confidence `min(1, tvl_prev / $5M)` where `tvl_prev` is the TVL before the
  week's change. The $5M floor is the snapshot's inclusion floor (smallest TVL it
  carries is $5,007,171): a protocol that was below the universe before its spike
  cannot let that spike decide its rank. Linear multiplier form kept from radar-2
  (`1 + g/100 x weight`) — only the weight, clamp and confidence changed.
- **Regression (step 2).** OLS on log10, sorted by slug for determinism, no wall
  clock, no unseeded randomness. Sample: live rows with `mcap_usd > 0`,
  `tvl_usd > 0`, both finite, AND `change_7d` non-null (invalid rows excluded by
  rule), AND in a rankable category (the board's exclusion rules). Aligned n=94;
  unaligned n=128 (verified: 144 rows carry mcap+tvl; 128 of those have tvl>0
  and mcap>0; 0 of the 128 have null growth; 34 of the 128 sit in excluded
  categories). min_n = 30, so 94 clears it. The fit also carries the
  `excluded_points` (the 34 left-out live tokens) so the dashboard can draw
  them grey and hollow beside the aligned sample. Validation: n ≥ 30, every x/y
  finite, variance of x > 0, coefficients finite, R² in [0, 1]; any failure →
  `status: 'failed'` + reason, coefficients null, dashboard shows FAILED with
  the reason and no numbers. TVL<$200M subset (parent-verified): n=102,
  b=0.6461, R²=0.0859.
- **Farm plans (step 3).** Still category templates (lookup by category substring,
  never by protocol name), now 8 steps per row: 1 safety, 2 category action,
  3 pre-deposit check, 4 yield break-even, 5 risks (NEW — costs and risks
  separated), 6 weekly action, 7 hold, 8 claim + farm log. Yield is an ASSUMPTION
  for break-even math (4% a year, labeled as an assumption, not a promise — the
  vault's own page states its actual rate at deposit time). Official points =
  only "check the official page" instructions: no points/incentive program is ever
  asserted to exist; the step says to check the official page and, if it publishes
  none, there is none to claim. Speculative items are labeled (the yield
  assumption; the hold-across-snapshots assumption).
- **Morpho venue/flag verification (live sources, 16 Nov 2026).**
  - `app.morpho.org` is Morpho's Vault app (docs.morpho.org: "Lend through Morpho
    Vaults, borrow or lend in Morpho Variable Rate Markets, manage positions, and
    track vault performance and market conditions").
  - Morpho's warning system is real (docs.morpho.org): `not_whitelisted` (YELLOW,
    vault not listed, shown in the Vault app), `deposit_disabled` (RED, vault on
    the curated deposit-disable list or no supply-queue allocation with remaining
    cap; can disable deposits in the Vault app), `low_liquidity` (YELLOW,
    withdrawable liquidity < 0.5% of total assets, shown in the Vault app).
  - A deposit cap can sit at zero / maxDeposit = 0, so a capped vault takes no
    deposit at all (shown on real vault pages, e.g. MEV Capital USR, Extrafi
    XLend USDC: "Deposits are capped", "Max deposit cap reached (maxDeposit=0)").
  - Vaults do fall more than 95% from peak (same vault pages carry that warning).
    That ">95%" wording is a third-party vault-data provider's warning text, NOT
    Morpho's own vocabulary, so the farm plan phrases it generically ("its value
    has not fallen far from its peak") and never attributes the 95% threshold to
    Morpho.
  - Gauntlet and MEV Capital curate Morpho vaults (verified on the same pages);
    Sentora curates Morpho vaults (morphowatch.com). BUT the board carries 47 rows
    in curator/allocator/risk categories and not all of them are on Morpho (the
    snapshot carries no venue field), so the check step names NO venue for the
    row: it says to check the vault on the venue's own page, and cites Morpho's
    flags only as the verified example of what a warning flag looks like.
  - No APY is cited anywhere: real vault APYs on the same pages run from 0% to
    10,000% (annualised artifacts on tiny vaults), which is exactly why the plan
    uses a labeled 4% assumption instead of any vault's rate.

## 3. Dashboard additions (within the byte budget)

- Validation panel: scatter of the live tokens (log10 TVL vs log10 mcap) with
  BOTH fitted lines — the aligned line (amber) through the 94 aligned points
  (filled) and the unaligned line (grey) through all 128, with the 34 excluded
  points drawn grey and hollow. a/b/R²/n for both fits and the typical
  deviation (10^median residual). Plain canvas, no SVG, no namespace string.
  On calibration FAILED it shows the failure and no numbers.
- One "kenapa rank ini" sentence per row, generated in JS from the multipliers
  already computed (biggest lift / biggest drag / spike check).
- Sensitivity test: each detail view shows the row's rank under the radar-2
  constants and under radar-3 with the spike-confidence check switched off.
- "Lonjakan belum terkonfirmasi" badge (confidence < 1) and "growth unreported"
  badge (null `change_7d`) in the growth column.
- Compare-two-protocols view: two dropdowns (default rank 1 vs rank 2) with a
  side-by-side table of TVL, growth, confidence, every multiplier, implied value
  and rank, plus the implied-value gap.
- Judge Review Guide section (definition in §0) after the model panel.
- Category levels in the model panel + detail view (Round 5): a consts row
  names the earned levels with their n ("Lending 0.77x n=15, Dexs 1.03x n=11",
  shrunk k=20, n≥10 only); each row's detail view shows its effective intercept
  (`10^a_eff`) and names the level when it differs from pooled. Cost ~0.7 KB of
  the 1.5 KB dashboard headroom (58,522 → 59,265 B).
- Dashboard line: the count of protocols with a CoinGecko id or symbol but no
  market cap (272), kept off the board — in the model panel note.

## 4. File-change log (every file changed, with its reason)

| File | Reason |
| ---- | ------ |
| `entry-v2/lib/model.ts` | Power-law base (`10^a x tvl^b`, aligned fit) in `impliedValue`, scored from the whole-dollar rounded base; `fitCalibration` as log10 OLS + validation + FAILED status + aligned sample + `full_*` fields + `excluded_points`; `base_scale`/`base_ref` REMOVED; `invalid_growth` flag through `BoardRow`/`RadarRow`; farm plans rewritten to 8 steps (risk step, assumption labels, official-page-only points); header + interface comments rewritten to describe the power law as THE base (12:37 decision) and the whole-dollar rounding truthfully (12:44 correction). |
| `entry-v2/dashboard/app.js` | `impliedOf` uses the row's stored base (page recompute matches board.json exactly); `impliedAlt` v2/noconf; `whyRank` wording; model panel formula + consts (power-law base, aligned + full fits, "live tokens in rankable categories"); validation panel + dual-fit scatter (94 aligned points, 34 excluded grey/hollow, two lines) with FAILED handling; farm-plan mirror of the new 8 steps; invalid-growth badge; detail-view equation label + invalid-growth line; compare view; Judge Review Guide; render() includes the new sections. |
| `entry-v2/dashboard/app.css` | `.warn` badge style (the badge class existed in JS but had no rule); `.compare` and `.guide` section styles. |
| `entry-v2/README.md` | Rewritten for radar-3: power-law base (aligned fit, weak R² stated), board numbers, farm-plan rules, Judge Review Guide pointer, whole-dollar rounding note, screenshots-stale note. |
| `entry-v2/TR-NOTES-v2.md` | This file (new): definitions, decisions, model, verification record. §§0–2 corrected 12:44 WITA to the 12:37 decision (power law is the base; reverse test inverts the power law). |
| `scratch-v2/check-gate.mjs` | Adapted from `scratch/check-gate.mjs`: power-law + confidence recompute, calibration-status + invalid-growth checks, full-precision recompute within $1, vendor import from `entry-v2/vendor/`. 14 checks (was 13: the ±$1 check is new). |
| `scratch-v2/test-adversarial.mjs` | Adapted from `scratch/test-adversarial.mjs`: radar-3 clamps/confidence, invalid-growth flag, log10 OLS values + FAILED path, 8 farm steps, reverse test, weakened-growth rank test, whole-dollar base test. |
| `scratch-v2/smoke-dom.mjs` | Adapted from `scratch/smoke-dom.mjs`: shell now has 8 sections on the pre-token tab; compare view + guide + invalid-growth badge + detail-dialog flag checks; synchronous `setTimeout` stub. |
| `scratch-v2/audit-198.mjs` | NEW: covers all 198 rankable protocols (178 board + 20 excluded with reasons). |
| `scratch-v2/compare-v1-v2.mjs` | NEW: board diff radar-2 vs radar-3 (ranking, implied MC, growth, confidence, regression). |
| `scratch-v2/compare-n128.mjs` | NEW: the same board scored under the unaligned n=128 fit, compared to the aligned n=94 board (median |Δrank|, unchanged, largest move, top-40 overlap) + top-40 overlap vs radar-2. |
| `scratch-v2/reverse-test.mjs` | NEW: reverse test (invert the power law per row, recover TVL). |
| `entry-v2/lib/model.ts` (Round 5) | `CategoryLevel` + `LEVEL_MIN_N=10` + `LEVEL_SHRINK_K=20`; `fitCalibration` computes shrunk per-category levels (Lending 0.77x on 15, Dexs 1.03x on 11); `impliedValue` scores with the row's `a_eff` (returned + stored as `a_eff` on `BoardRow`/`RadarRow`); header comment describes the levels. |
| `entry-v2/dashboard/app.js` (Round 5) | Model-panel consts row for the levels + intro sentence; detail view shows the row's `a_eff` and names the level when it differs from pooled; Guide step 3 numbers re-measured to 0.000029% / 0.000066%. |
| `entry-v2/README.md` (Round 5) | Base formula uses `a_eff`; new category-levels bullet; board line median |Δrank| 3→4. |
| `entry-v2/TR-NOTES-v2.md` (Round 5) | §2 category-levels section + formula block; §3/§4/§5/§6 updated; §0 reverse-test numbers re-measured (0.000029% / 0.000066%). |
| `scratch-v2/reverse-test.mjs` (Round 5) | Inversion uses the row's stored `a_eff` (pooled `a` as fallback). |
| `scratch-v2/check-gate.mjs` (Round 5) | Full-precision recompute uses the row's `a_eff` from data.js. |
| `scratch-v2/test-adversarial.mjs` (Round 5) | New §12 level tests (8 tests): exactly 2 levels, Lending/Dexs values, Yield/RWA pooled, base ratio, slope pooled, peak <$100M, exact-name lookup. |
| `scratch-v2/farm-sync-check.mjs` (Round 5) | Guide step 3 check now recomputes the worst inversion errors from board.json instead of hard-coding them (the hardcoded pair let the Guide go stale in Round 5). |
| `scratch-v2/prev-board.json` (NEW, Round 5) | The pre-levels pooled board, saved before the rebuild for the movement comparison. |

NOT changed: `entry/` (radar-2, submitted), `token-radar-01-kit/` (sealed kit),
`~/workspace/make-fun/chess-engine/` (parallel chess hunt). `main.ts` and
`vendor/makefun-board.ts` needed no change (the build pipeline is identical).

## 5. Board: radar-3 vs radar-2 (measured, not assumed)

- Regression (log10 OLS, verified by independent recomputation): ALIGNED a = 3.9077,
  b = 0.4049, R² = 0.1026, n = 94, median residual factor 3.53x. UNALIGNED a = 3.0247,
  b = 0.5223, R² = 0.1939, n = 128, median residual factor 3.37x. (ln-form
  equivalents: aligned a = 8.998, b = 0.405, R² = 0.103 — matches the parent's
  independent recomputation exactly; unaligned a = 6.9646, b = 0.5223.) TVL<$200M
  subset: n = 102, b = 0.6461, R² = 0.0859 (parent-verified). Both fits are weak:
  the base is a rough calibration, and the dashboard says so.
- Radar-3 board: 178 rows, implied $47,387,177 → $2,598,523, 178 distinct values,
  0 adjacent ties, watchlist 40/40, live view 24.
- Top 10: 1 Steakhouse $47.4M, 2 Veda $39.7M, 3 Gauntlet $39.3M, 4 USDD $32.9M,
  5 Upshift $27.7M, 6 Bittensor dTAO $19.5M, 7 OnRe $19.2M, 8 OpenTrade $18.7M,
  9 Symbiotic $18.6M, 10 Plume Vaults $18.3M. (Round 5 levels: Bittensor dTAO
  is a Dexs row, so its base rises 1.03x and it passes OnRe; nothing else in
  the top 10 moves.)
- Shift DeFi: rank 42 (v1: rank 6), $8,950,019 (v1: $213,728,193), confidence
  0.209, effective growth 20.9% (was +4,448.5% unweighted). Monolith: rank 132
  (v1: rank 70), $4,865,103. Neither value moved in Round 5 (neither row is
  Lending or Dexs); both ranks rose 1 because Lending rows above them fell.
- Rank movements vs radar-2 (178 shared slugs): median |Δrank| = 4, 40 moved
  ≥10 places, 18 moved ≥20, 23 unchanged, top-40 same 37/40 (v1 top-40 lost
  shift-defi, nuva and flux-finance; new top-40 gained yuzu-money, noon and
  vfat.io). Biggest risers: anemoy-capital 145→83, syncswap 137→114, fstswap
  106→85, metalx-swap 131→111, origami-finance 79→60, katana-dex 143→124.
  Biggest fallers: monolith-market 70→132, fira 77→120, shift-defi 6→42,
  vena-finance 136→170, current 45→75, project-0 46→74.
- Aligned vs unaligned fit (n=94 vs n=128, same board otherwise — measured on
  the pooled-intercept build, before the Round 5 levels): median |Δrank| = 2, 31
  unchanged, largest move 13, top-40 same 39/40. Monolith: n=128 rank 139
  ($4,062,652) → n=94 rank 133 ($4,865,103) on that build; the levels build
  has it at rank 132 (same value — Monolith is not a Lending/Dexs row). The n=128 board's
  top 10: Steakhouse $79.6M, Veda, Gauntlet, USDD, Upshift, Bittensor dTAO,
  OnRe, Nonce, OpenTrade, Symbiotic. All four comparison figures match the
  parent's independent check numbers exactly.
- Confidence < 1 on the board: 3 rows (shift-defi 0.21, monolith-market 0.54,
  mezzanine 0.99). Invalid growth on the board: 2 rows (estate-protocol,
  swan-dao).
- 198 audit: rankable 198 = 178 board + 20 above-floor not in the sealed
  watchlist; rankable below floor 138 (all on board); rankable above floor 60 =
  40 in watchlist + 20 not. Top 3 of the 20 by TVL: Sentora Curator $2.76B,
  Polymarket International $320M, CIAN Yield Layer $280M. Exclusion partition of
  the 342 pre-token rows (first-match order): CEX 42, other excluded categories
  86, versioned names 11, wrapped/staked words 5, exchange prefixes 0
  (sum 144; rankable 198). Audit notes: (a) 272 tickered-no-mcap protocols
  (258 symbol-only, 14 gecko+symbol) are counted as "live" by
  categoryLaunchRates, inflating the global rate to 0.549 (mcap-only 0.19) —
  noted, rates unchanged; (b) 16 snapshot rows have non-positive mcap (15× 0,
  1× −1 autofinance) — correctly excluded by the strict mcap>0 filter; (c) the
  20 above-floor rows are described ONLY as "not in the sealed watchlist" —
  never a parent-token reason (the snapshot cannot prove it).

## 6. Verification record (actual outputs)

### Round 1 — functional (L2 board + determinism)
- `main.ts` run twice into `scratch-v2/out1/` and `scratch-v2/out2/`:
  `diff -r` clean — byte-identical. (Two runs, 16 Nov 2026 ~16:52 WITA.)
- `check-gate.mjs scratch-v2/out1` — **ALL 14 CHECKS PASS**:
  ```
  PASS  dashboard_files — 3 files, 58149 bytes, html=true css=true js=true
  PASS  board_file — 178 rows, 479905 bytes
  PASS  sorted_by_value — ranks 1..178, implied 47387177 -> 2598523
  PASS  coverage — 40/40 watchlist slugs
  PASS  farm_steps — 178 rows x 8 steps, all 20..600 chars
  PASS  screenshots — 3 images (STALE v1 shots: gate row passes on file validity only; re-take needed for code agreement)
  PASS  dossier_matches — 1108756 bytes, byte-identical to buildDossier: true, text 58413 B (cap 65,536)
  PASS  exclusion_proof — 0 rows in excluded categories, 0 versioned names, 0 wrapped/staked words, 0 exchange prefixes
  PASS  dashboard_source_cap — 58149 bytes (cap 60,000)
  PASS  page_board_agreement_exact — 178 rows: data.js matches board.json and the page recompute matches EXACTLY
  PASS  live_view — 24 live-token rows, all with market caps, none ranked
  PASS  full_precision_recompute_within_$1 — worst difference $1 across 178 rows (whole-dollar rounding, not a bug)
  PASS  calibration — aligned a=3.9077 b=0.4049 R2=0.1026 n=94; full a=3.0247 b=0.5223 R2=0.1939 n=128
  PASS  invalid_growth_flags — flagged: estate-protocol, swan-dao; all with growth multiplier 1.00x
  ```
- Hashes (final build): board.json
  `e3b7cb800fea06320ff0df940aa75af336a6e890dcd7632d0feb1c21f03d4347`,
  data.js `fff1fa0a3d4ab57ff675c384e7f675360142d495a873878cb9a55a5e6f0d8bb2`,
  dossier.json `aa259b1f885306a0a724449802900d09aaa542eabe174049842e54bb21c19954`.
- Dossier text 58,413 B (cap 65,536) from the real buildDossier output; dossier
  file 1,108,756 B (< 1.5 MiB); dashboard source 58,149 B (cap 60,000); data.js
  102,375 B (NOT counted in the dossier text). Note: the parent's 47,193 B
  dossier-text figure predates the dashboard additions (compare view, guide,
  validation panel); the measured size from the real buildDossier output is
  58,413 B — still 7,123 B under the cap.
- The $1 miss found and fixed in this round: after the 12:44 rounding revert the
  gate FAILED `page_board_agreement_exact` on upshift (page $27,686,836 vs board
  $27,686,835) — the board scored from the unrounded fit while the page used
  the stored rounded base. Fix: score the board from the rounded base (see §2).
  Re-run after the fix: exact on all 178 rows. 36 rows' implied values moved
  by $1; no rank changed.

### Round 2 — adversarial (L1 unit + reverse test)
- `test-adversarial.mjs` — **ALL 56 TESTS PASS**, including: null change_7d →
  M_g 1.0 + flag; growth clamps (+4448.5% → +100%, −72.7% → −40%); spike
  confidence = tvl_prev/$5M (Shift 0.2093, tvl_prev $1,046,505, effective growth
  20.93%); null listed_at → 365-day maturity; 0 chains → 1.00x, 45 chains →
  1.15x capped; tiny/null category → global rate 0.5488; all exclusion cases
  (6 categories, 3 versioned names, wrapped/staked words, 2 exchange prefixes);
  aligned fit n=94 b~0.40 R²~0.10; full fit n=128 b~0.52 R²~0.19; degenerate
  snapshot → FAILED with null coefficients; 16 non-positive mcap rows excluded;
  178 distinct values, 0 adjacent ties; 8 farm steps/row, 116–398 chars; base
  stored as whole dollars (0/178 non-integer); power-law ratio 5.07x ($2.75B vs
  $50M, not 55x); growth deliberately weaker (+150% at $100M no longer beats
  flat $1B; +100% at $500M does).
- `reverse-test.mjs` — **ALL ROWS INVERT WITHIN TOLERANCE**: rows tested 178,
  worst from-base inversion error 0.000025% (loopscale-curation), worst
  from-implied inversion error 0.000056% (damm-capital), tolerance 0.1%.
- `audit-198.mjs` — **COUNTS AGREE** (198 = 178 + 20); artifact
  `scratch-v2/audit-198.json`. Full numbers in §5.

### Round 3 — independent (L3 render + criteria re-read)
- `smoke-dom.mjs` — **ALL 17 PAGE SMOKE TESTS PASS**: board renders 178 data
  rows; shell has 8 sections; compare view renders two selects + 10-row table;
  guide renders with the local-metrics note; model panel names both fits
  (n=94 and n=128); 2 invalid-growth badges; 3 spike badges; live tab 24 rows;
  Dexs filter 20 rows; Base chain filter 35 rows; search "steakhouse" 1 row;
  detail dialog opens with breakdown + farm plan (8 steps) + fitted-base
  equation + exact recompute line; invalid-growth detail flag; empty filter
  renders the empty state.
- `compare-v1-v2.mjs` + `compare-n128.mjs` — numbers in §5; all four parent
  check figures match (n=128 vs n=94: median 2, unchanged 31, largest 13,
  top-40 39/40; radar-2 vs n=94: median 3, unchanged 17, top-40 38/40).

### Kit check (gate rows)
- The kit's gate is the 7 gate rows in RULES.txt plus the entry's stricter
  checks — all covered by `check-gate.mjs` (14/14 PASS above). GREEN.
- `data.js` carries `source: "DefiLlama https://api.llama.fi/protocols,
  fetched 2026-11-14T01:18:33.201Z"` — identical to v1's data.js, which passed
  the gate; data.js is written OUTSIDE `dashboard/`, and no step copies it (or
  any file containing a URL) into `dashboard/`. Dashboard files contain no
  "https://" strings (verified: index.html false, app.css false, app.js false).

### Gitleaks
- `gitleaks detect --source entry-v2 --no-git`: scanned ~162,405 bytes,
  **no leaks found** (16 Nov 2026).

### Round 4 — reviewer fixes, 16 Nov 2026 ~13:00 WITA (pre-submit, screenshots on hold)
Reviewer (Claude, via the user) re-verified the n=94 build from the snapshot's
own fields (implied recompute 178/178 rows, $0 difference) and required four
small fixes. All four landed here; nothing else changed. Files changed, with
reasons:
- `lib/model.ts` — `gasFor` is now chain-aware: Ethereum mainnet keeps
  "about $8 / $4 of gas", any other first chain says "a few cents of gas".
  Step 2's cost string uses the phrase (was: `about $${gasFor(capital)} of gas`).
- `dashboard/app.js` — mirrored `gasFor` + step-2 cost (same strings as
  model.ts), and Guide step 3 now states the measured inversion results
  instead of telling the judge to run the reverse-test script (not in the
  bundle): all 178 rows return their TVL, worst 0.000025% from the base,
  0.000056% from the implied value, tolerance 0.1%.
- `TR-NOTES-v2.md` — reverse-test section reworded: the inversion is a
  stored-figures consistency test, NOT a proof no number was hand-set (a
  hand-edited multiplier+implied pair would still invert); the real proof is
  the reviewer's independent recompute from the snapshot's fields, 178/178
  rows, $0 difference. §1: the "mostly sub-products / pools" clause deleted;
  the 20 are described only as "not in the sealed watchlist", with the factual
  note that the snapshot's ten fields carry no `parentProtocol`.
- `TR-NOTES.md` — same forbidden clause deleted from the v1-notes copy (§1
  equivalent): the 20 are now "described only as not in the sealed watchlist".
- `scratch-v2/reverse-test.mjs` — header comment corrected the same way (the
  "would not invert" overstatement is gone from everywhere).
- `scratch-v2/farm-sync-check.mjs` (NEW) — runs `app.js` against the DOM stub
  for every row's detail dialog and checks the page's farm plan equals
  board.json's farm_steps, plus that Guide step 3 carries the measured
  inversion numbers.
Measured after the fixes (re-run of the full suite):
- `main.ts` twice into `scratch-v2/out1/` + `out2/`: `diff -r` clean —
  byte-identical.
- `check-gate.mjs scratch-v2/out1` — **ALL 14 CHECKS PASS** (dashboard source
  58,522 B, cap 60,000; dossier text 58,786 B, cap 65,536; dossier file
  1,109,133 B; page/board agreement exact on 178 rows; calibration aligned
  a=3.9077 b=0.4049 R²=0.1026 n=94).
- `test-adversarial.mjs` — **ALL 56 TESTS PASS**. `reverse-test.mjs` — 178
  rows, worst 0.000025% / 0.000056% (same numbers the Guide now states).
  `smoke-dom.mjs` — **ALL 17 PAGE SMOKE TESTS PASS**.
  `farm-sync-check.mjs` — **PASS**: page farm plan matches board.json on
  178/178 rows exact; Guide step 3 carries the measured numbers, no
  run-it-yourself wording. `gitleaks` — scanned ~175,812 B, **no leaks found**.
- Board before/after diff (`/tmp/prev-board.json` vs new `board.json`):
  **0 rows moved rank or value** — top 5 unchanged (Steakhouse $47,387,177;
  Veda $39,665,797; Gauntlet $39,317,364; USDD $32,876,191; Upshift
  $27,686,836); Shift DeFi still rank 43 ($8,950,019); Monolith still rank 133
  ($4,865,103). Farm text changed on exactly the 128 non-Ethereum rows
  (4 × "about $8 of gas" → "a few cents of gas": Steakhouse/Base, Veda/Ink,
  Gauntlet/Base, USDD/Tron; 124 × "about $4 of gas" → "a few cents of gas");
  the 50 Ethereum rows keep "about $4 of gas". 0 rows say "$8" now.
  Farm plan still 8 steps/row, 116–398 chars, no "http", no
  "guarantee"/"confirmed", no points program claimed.
- Bundle re-grepped after the edits: `dashboard/app.js`, `dashboard/index.html`,
  `README.md`, `data.js` contain no sub-product / parent-token reason claim.
  `entry/` untouched (0 files modified today, verified by mtime scan).
- Kit check: the kit's gate rows are covered by `check-gate.mjs` (14/14 PASS).
  GREEN.
- Hashes (post-fix build): board.json
  `b0fe08fa7a5f7af2d44d531b13155fefe444bbea5e66b0630c664a22f3d2f6d3`,
  data.js `fff1fa0a3d4ab57ff675c384e7f675360142d495a873878cb9a55a5e6f0d8bb2`
  (unchanged — farm text is not in data.js and no value moved), dossier.json
  `a97a18489b70eda51d735b9ca125a712b6e4797dc977a18430ac955208d48ade`.

### Round 5 — category levels, 16 Nov 2026 ~13:20 WITA (rank improvement, screenshots still on hold)
Parent order: the rank must move significantly; the strongest legitimate lever
found was category-specific calibration of the base (pooled R²=0.10; within-category
univariate R²: Lending 0.37, Dexs 0.32, Yield 0.21, RWA 0.50). Implemented as LEVEL,
not slope, per §2: only Lending (n=15, 0.77x) and Dexs (n=11, 1.03x) earn a level,
shrunk k=20; slope pooled for every row. Files changed, with reasons: see §4
(Round 5 rows). Measured after the change (full suite re-run):
- `main.ts` twice into `scratch-v2/out1/` + `out2/`: `diff -r` clean —
  byte-identical.
- `check-gate.mjs scratch-v2/out1` — **ALL 14 CHECKS PASS** (dashboard source
  59,265 B, cap 60,000 — headroom 735 B; dossier text 59,529 B, cap 65,536;
  dossier file 1,096,645 B; page/board agreement exact on 178 rows; calibration
  aligned a=3.9077 b=0.4049 R²=0.1026 n=94; levels in data.js: Dexs a_cat=3.9414
  a_eff=3.9196 level 1.028x, Lending a_cat=3.6427 a_eff=3.7941 level 0.770x).
- `test-adversarial.mjs` — **ALL 63 TESTS PASS** (8 new §12 level tests).
  `reverse-test.mjs` — 178 rows, worst 0.000029% (granite) / 0.000066%
  (granite), tolerance 0.1%. `smoke-dom.mjs` — **ALL 17 PAGE SMOKE TESTS PASS**.
  `farm-sync-check.mjs` — **PASS**: page farm plan matches board.json on
  178/178 rows exact; Guide step 3 carries the re-measured numbers. `gitleaks`
  — scanned ~188,760 B, **no leaks found**.
- Board movement vs the pooled build (`scratch-v2/prev-board.json`): median
  |Δrank| = 2, 43 unchanged, max move 41, 14 moved ≥10, top-40 same 39/40
  (flux-finance out, vfat.io in). Peak/floor UNCHANGED ($47,387,177 →
  $2,598,523; peak < $100M). Top 10: only Bittensor dTAO / OnRe swap places
  (7→6 / 6→7 — Bittensor is a Dexs row, +2.8%). Shift DeFi 43→42 and Monolith
  133→132, both values UNCHANGED (neither row is Lending/Dexs; both rose 1
  because Lending rows above them fell). Value ratios by category: ONLY
  Lending 0.770x (14 rows) and Dexs 1.028x (20 rows) move; every other
  category is exactly 1.000x.
- **The >25-rank moves, documented reason (brief requires one): all 11 rows
  moving >25 are Lending rows at exactly 0.770x — fira 79→120, templar-lending
  47→78, marginfi-lending 49→80, vesu 124→155, project-0 44→74, current 45→75,
  mystic-finance-lending 51→81, native-credit-pool 64→93, vena-finance
  142→170, bend 140→166, granite 149→175. The board is dense in the $4–10M
  band, so a 23% value drop crosses 26–41 neighbours. That is the level doing
  exactly what it was designed to do (Lending live tokens trade at 0.54x the
  pooled line raw, 0.77x shrunk), not a bug. No Dexs row moves >25 (level
  only 1.03x). Farm plan still 8 steps/row, 116–398 chars, no "http", no
  "guarantee"/"confirmed", no points program claimed.
- **Stale Guide numbers, caught and fixed in this round.** The levels moved the
  worst inversion rows (granite, 0.000029% / 0.000066%), but the Guide still
  stated the Round 4 numbers (0.000025% / 0.000056%) and the old
  farm-sync-check hardcoded them, so it passed with stale numbers. Fixed:
  Guide states the re-measured numbers, and the check now recomputes the worst
  errors from board.json and requires the Guide to carry exactly those — a
  hardcoded pair can never go stale again. §0 updated to the new numbers.
- Kit check: the kit's gate rows are covered by `check-gate.mjs` (14/14 PASS).
  GREEN. `entry/` untouched (0 files modified today, verified by mtime scan).
- Hashes (post-levels build): board.json
  `bedd203bf7bf976832ce63a5121b11aa645b5ef85798c38a5453e47094671916`,
  data.js `a63b73eceef35a0b3915d9cb3705c31859cafaff99c98fee37d3a65a9ba155d0`,
  dossier.json `a76d42695251262da2991eb977111e5b7796fe88e044d6fd38def82b21798c79`.

## 7. Open items / blockers

- **Screenshots are STALE and must be re-taken.** `entry-v2/screenshots/` holds the
  three v1 shots (1-board.png 237,467 B, 2-detail.png 321,222 B, 3-filtered.png
  227,995 B, copied with `entry/`). They show the radar-2 dashboard, not radar-3,
  so criterion 1 (screenshots agree with the code) fails until they are re-taken.
  Re-taking needs a live browser (GitHub Pages repo `cupucepu/token-radar-shots`
  + thum.io renders, 1280×853 — the v1 route in `scratch/make-pngs.mjs`); this
  subagent has no browser. **Size trap (reviewer, 12:59 WITA):** the dossier file
  (1,109,133 B) embeds the three screenshots base64 (~786,684 B of image, ×4/3
  ≈ 1.05 MB), so against the 1.5 MiB dossier cap the three NEW PNGs should
  total ≤ ~1.1 MB (~375 KB each), NOT 512 KiB each. This is the reviewer's
  inference — verify with `buildDossier` after the re-take. Do not edit the
  dashboard after the photos are taken. The gate's screenshots row still
  passes on the stale files (they are whole PNGs within size/dimension caps),
  but the judge-facing agreement does not. Flagged for the parent.
- The round-first base fix (12:44 correction) is DONE and re-verified (gate
  14/14, page/board exact on all 178 rows). No other open items.
