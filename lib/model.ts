// Token Radar's model, version radar-4: one snapshot of the protocol universe in, one ranked board out.
// Radar-4 keeps radar-3's scoring model exactly -- the same fitted power-law base, the same
// growth clamp, maturity, chains and category launch rate, the same 8-step farm plans -- and
// adds what the radar-3 diagnosis found missing: the out-of-sample test computed at run time
// (leave-one-out cross-validation and a TVL-split forward test, both fits, shown on the
// dashboard), every farm plan netted against its own costs with a farm/thin/skip verdict, the
// 20 rankable protocols above the floor that the coverage rule leaves off the board, and a
// one-sentence statement of how the launch rate counts a protocol as already-trading.
// The base stays the ALIGNED fit: the forward test and the paired leave-one-out test give the
// all-rows fit no significant advantage (see TR-NOTES-v4.md §5), and the aligned sample is
// the same kind of protocol the board ranks.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) plus every
// rankable pre-token protocol below the watchlist floor. A protocol is rankable when it records no
// token (no market cap, no CoinGecko id, no symbol) and is not an exchange, a bridge, a liquid
// staking or restaking product, a versioned pool, or a wrapped / staked / staking product, and its
// name does not begin with an exchange's name. The live-token protocols are kept apart and shown at
// the market's own values, never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures. Nothing is special-cased by name and
// no row is hand-picked; the same function scores every protocol:
//
//   base     = 10^a_eff x tvl_usd^b                   -- the power law fitted at run
//                                                         time to the snapshot's own live
//                                                         tokens (log10 OLS; see
//                                                         fitCalibration). The aligned fit
//                                                         is the base: a=3.91, b=0.40,
//                                                         R2=0.10 on n=94 live tokens. The
//                                                         fit is WEAK -- it explains 10% of
//                                                         the spread, the typical token sits
//                                                         3.5x off the line -- and the
//                                                         dashboard says so. The unaligned
//                                                         fit (all 128 live tokens: a=3.02,
//                                                         b=0.52, R2=0.19) is reported
//                                                         beside it for transparency. The
//                                                         intercept a_eff is the category's
//                                                         shrunk level when the category
//                                                         earned one (Lending n=15: 0.77x,
//                                                         Dexs n=11: 1.03x on the base;
//                                                         k=20 shrinkage toward pooled),
//                                                         else the pooled a. The SLOPE b
//                                                         stays pooled for every row, so the
//                                                         base stays concave and cannot
//                                                         explode at large TVL. There is no
//                                                         log base any more: the radar-2
//                                                         constants $120M / $10M are gone,
//                                                         and with them the base they set.
//                                                         Maturity, chains and category
//                                                         are radar-2's, unchanged.
//   growth   = clamp(change_7d, GROWTH_FLOOR, GROWTH_CAP) x confidence
//                                                         -- confidence = min(1, tvl_prev / floor):
//                                                         a spike counts only as far as the
//                                                         protocol was already big before it.
//                                                         tvl_prev = tvl / (1 + change_7d / 100).
//                                                         A null change_7d is invalid input:
//                                                         growth counts as 0 (M_g = 1.0) and the
//                                                         row carries an invalid-growth flag
//                                                         the board displays.
//   growthM  = 1 + (growth / 100) x GROWTH_WEIGHT       -- 0.80x .. 1.50x
//   maturity = MATURITY_FLOOR + min(age, MATURITY_DAYS) / MATURITY_DAYS x MATURITY_RANGE
//                                                             -- age is days since first listed;
//                                                             unknown age counts as UNKNOWN_AGE_DAYS
//   chainsM  = 1 + CHAIN_STEP x min(chains - 1, CHAIN_CAP)     -- 1.00x .. 1.15x
//   catM     = CAT_FLOOR + launchRate(category) x CAT_RANGE    -- launchRate is the share of the
//                                                             category's protocols that already
//                                                             trade a token, counted from this
//                                                             snapshot at run time; categories with
//                                                             fewer than MIN_CATEGORY_PROTOCOLS
//                                                             protocols use the global rate
//   implied  = max(1, round(base x growthM x maturity x chainsM x catM))
//
// Every constant is stated in the dashboard and in README.md. The dashboard shows each row's
// breakdown (base, growth multiplier, maturity multiplier, chain multiplier, category multiplier)
// so the judge can verify the value follows from the figures. The dashboard also shows the
// calibration itself (a, b, R2, n and the scatter of live tokens) so the judge can see how
// weakly the base is pinned -- and it shows the unaligned fit beside the aligned one, so the
// choice of sample is visible, not hidden. The base is rounded to whole dollars FIRST, and
// the implied value is scored from that rounded base: board, data.js and the page all use
// the same whole-dollar number, so the page's recompute matches the board exactly. An
// independent full-precision recompute from the dashboard's a/b may differ by at most $1
// per row -- that is the rounding, not a bug.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. There is no base constant any more:
 * the base is the power law fitted at run time (see fitCalibration). The universe floor is
 * the snapshot's inclusion floor: no protocol below $5M of TVL is in the snapshot at all (the
 * smallest TVL it carries is $5,007,171), so a pre-spike TVL below it means the protocol was
 * not in the universe before the spike. */
export interface ModelConstants {
  universe_floor_usd: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
  cat_floor: number;
  cat_range: number;
  min_category_protocols: number;
}

export const MODEL: ModelConstants = {
  universe_floor_usd: 5_000_000,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 100,
  maturity_floor: 0.75,
  maturity_range: 0.25,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.015,
  chain_cap: 10,
  cat_floor: 0.85,
  cat_range: 0.3,
  min_category_protocols: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** The smallest live-token sample the fit is allowed to run on. Below it the fit is not a
 * calibration at all, and fitCalibration reports FAILED instead of inventing numbers. */
export const CALIBRATION_MIN_N = 30;

/** A category earns its own base level only with this many live rows in the aligned
 * sample. Below it the per-category intercept is noise (a single live token can sit
 * 567x off the pooled line), so the category uses the pooled intercept. */
export const LEVEL_MIN_N = 10;

/**
 * The pooled evidence a category's own level is diluted with. Read it as a count
 * of imaginary pooled rows standing beside the category's real ones: a category
 * with n live rows keeps n / (n + POOLED_PRIOR_COUNT) of the gap between its own
 * intercept and the pooled one, and the rest of the gap is closed toward pooled.
 * Twenty is a strong dilution: even a 15-row category keeps under half of its
 * deviation. That is the intent -- a level is a small correction to the shared
 * fit, not a second fit per category. The slope is shared by every row; the level
 * touches the intercept alone, and only for categories with enough live rows.
 */
export const POOLED_PRIOR_COUNT = 20;

/**
 * A category's intercept after dilution: the pooled intercept plus the fraction
 * of the category's own deviation that survives. The fraction grows with n, so a
 * bigger category speaks louder, but it never reaches one, so no category fully
 * escapes the pooled line. This is the single place the shrink happens;
 * fitCalibration calls it and nothing else computes a level.
 */
function shrunkIntercept(pooledA: number, categoryA: number, n: number): number {
  return pooledA + (n / (n + POOLED_PRIOR_COUNT)) * (categoryA - pooledA);
}

/**
 * The multiplier a shrunk intercept puts on the base: ten to the power of the
 * shrunk intercept minus the pooled one. Below pooled the multiplier sits under
 * one and pulls the base down; above pooled it sits over one and lifts the base.
 * It is the ratio between the category's base and the pooled base at the same
 * TVL, so it says exactly how much the level moves the base, up or down.
 */
function levelMultiplier(shrunkA: number, pooledA: number): number {
  return Math.pow(10, shrunkA - pooledA);
}

/** The smallest implied value a board row may carry: one whole dollar. The base
 * is rounded to whole dollars before the multipliers apply, and the implied value
 * is scored from that rounded base, so a row cannot fall below a dollar -- and a
 * value below it would mean the rounding or the multipliers broke, not that the
 * protocol is worth less. The gate refuses such a board outright. */
export const IMPLIED_MIN_USD = 1;

/** The largest implied value a board row may carry: a hundred trillion dollars.
 * No protocol the board ranks is worth that much, so a value above it means the
 * power law exploded -- a slope that was never pooled, a level that was never
 * shrunk -- and the gate refuses the board instead of publishing the number. */
export const IMPLIED_MAX_USD = 1e14;

/** A farm step's length bounds, in characters: the gate takes a step only between
 * twenty and six hundred characters. Shorter than twenty is not a step, it is a
 * fragment; longer than six hundred is a paragraph, not a step. The trim keeps
 * four characters of headroom so the ellipsis it appends still fits under the cap. */
export const FARM_STEP_MIN_CHARS = 20;
export const FARM_STEP_MAX_CHARS = 600;

/** One category's base level: the raw per-category intercept at the pooled slope
 * (a_cat), the shrunk intercept actually used (a_eff), and the multiplier on the base
 * that a_eff implies (level = 10^(a_eff - A)). */
export interface CategoryLevel {
  category: string;
  n: number;
  a_cat: number;
  a_eff: number;
  level: number;
}

/** One out-of-sample score: a fit's predictions of live tokens it was not fitted to.
 * `r2` is against the mean of the held-out actuals (it can go negative: worse than
 * predicting the mean); `med`/`mean` are median/mean |error| in log10 market-cap
 * units; `within2x` is the share of predictions within a factor of two of the actual
 * market cap (|error| <= log10 2); `typ` is 10^med, the typical factor the prediction
 * is off by. `n` is the number of held-out predictions the score rests on. */
export interface OutOfSample {
  r2: number | null;
  med: number | null;
  mean: number | null;
  within2x: number | null;
  typ: number | null;
  n: number;
}

/** The TVL-split forward test: the same fit trained on one half of the live sample
 * by TVL and tested on the other, both directions, for the aligned sample and the
 * all-rows sample side by side. A forward test is harsher than leave-one-out: it asks
 * whether the fit extrapolates across the TVL range, not just across neighbouring
 * points. Levels are refit on the TRAIN half only, so a half with no category at
 * n>=10 runs without levels -- the test measures the pooled power law then, and says
 * so in TR-NOTES-v4.md. */
export interface ForwardTest {
  aligned: { small_to_large: OutOfSample; large_to_small: OutOfSample };
  full: { small_to_large: OutOfSample; large_to_small: OutOfSample };
}

/** The base's calibration: the power law log10(mcap) = a + b x log10(tvl) fitted to the
 * snapshot's live tokens at run time. `a/b/r2` are the ALIGNED fit -- the model base: live
 * tokens whose category the board's own exclusion rule keeps out (CEX, Bridge, Canonical
 * Bridge, Liquid Staking, Liquid Restaking, Restaked BTC) are not in the sample, so the fit
 * is fitted to the same kind of protocol the board ranks. `full_*` is the UNALIGNED fit
 * over every live token, reported beside it so the choice of sample is visible. `points`
 * are the aligned sample's live tokens (TVL and market cap only), for the dashboard's
 * scatter; `excluded_points` are the live tokens the alignment leaves out (34 of them),
 * drawn grey and hollow beside the aligned sample. `levels` are the per-category base
 * levels: only categories with at least LEVEL_MIN_N live rows in the aligned sample
 * earn one, diluted toward the pooled intercept by POOLED_PRIOR_COUNT, and the SLOPE stays
 * pooled for every row -- so a level is a small intercept shift, never a new fit. `loo` is
 * the leave-one-out cross-validation of both fits, computed at run time by refitting on every
 * 93/127-token subset: the aligned fit and the all-rows fit side by side, so the choice of
 * sample is judged on held-out error, not on in-sample R2. `forward` is the TVL-split
 * forward test of both fits, same treatment. On failure `status` is 'failed', `reason` names
 * why, and every coefficient is null: there is no fallback base and no invented number. */
export interface Calibration {
  status: 'ok' | 'failed';
  reason: string | null;
  a: number | null;
  b: number | null;
  r2: number | null;
  n: number;
  median_resid: number | null;
  points: Array<{ t: number; m: number }>;
  excluded_points: Array<{ t: number; m: number }>;
  full_a: number | null;
  full_b: number | null;
  full_r2: number | null;
  full_n: number;
  levels: CategoryLevel[];
  loo: { aligned: OutOfSample; full: OutOfSample };
  forward: ForwardTest;
}

function failedCalibration(reason: string, full: { a: number | null; b: number | null; r2: number | null; n: number }): Calibration {
  return { status: 'failed', reason, a: null, b: null, r2: null, n: 0, median_resid: null, points: [], excluded_points: [], full_a: full.a, full_b: full.b, full_r2: full.r2, full_n: full.n, levels: [], loo: { aligned: nullOutOfSample(), full: nullOutOfSample() }, forward: { aligned: { small_to_large: nullOutOfSample(), large_to_small: nullOutOfSample() }, full: { small_to_large: nullOutOfSample(), large_to_small: nullOutOfSample() } } };
}

/** An out-of-sample score with no measurement: every field null, n zero. */
function nullOutOfSample(): OutOfSample {
  return { r2: null, med: null, mean: null, within2x: null, typ: null, n: 0 };
}

/** Ordinary least squares on the log10 points, with the fit's strength. Returns nulls when
 * the points cannot support a fit (too few, no TVL spread, or a non-finite result). */
function olsLog10(pts: Array<{ x: number; y: number }>): { a: number | null; b: number | null; r2: number | null; median_resid: number | null } {
  const n = pts.length;
  if (n < 2) return { a: null, b: null, r2: null, median_resid: null };
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return { a: null, b: null, r2: null, median_resid: null };
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) * (p.x - mx);
    sst += (p.y - my) * (p.y - my);
  }
  if (!(sxx > 0) || !(sst > 0)) return { a: null, b: null, r2: null, median_resid: null };
  const b = sxy / sxx;
  const a = my - b * mx;
  let ssr = 0;
  const resids: number[] = [];
  for (const p of pts) {
    const r = p.y - (a + b * p.x);
    ssr += r * r;
    resids.push(Math.abs(r));
  }
  let r2 = 1 - ssr / sst;
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(r2) || r2 < -1e-9 || r2 > 1 + 1e-9) {
    return { a: null, b: null, r2: null, median_resid: null };
  }
  r2 = Math.min(1, Math.max(0, r2));
  resids.sort((x, y) => x - y);
  return { a, b, r2, median_resid: resids[Math.floor(resids.length / 2)] ?? null };
}

/**
 * The intercept one live token implies at the pooled slope: its log market cap
 * minus the slope times its log TVL. A token exactly on the fitted line implies
 * the pooled intercept; a token above the line implies a higher one. A category's
 * intercept is the mean of its tokens' implied intercepts, so this is the single
 * place the per-token figure is computed -- the accumulation in fitCalibration
 * calls it and nothing else inlines the arithmetic.
 */
function impliedIntercept(tvlUsd: number, mcapUsd: number, slope: number): number {
  return Math.log10(mcapUsd) - slope * Math.log10(tvlUsd);
}

/**
 * The live-token samples the calibration fits: the FULL sample (every live token with a
 * positive finite market cap and TVL and a reported seven-day change) and the ALIGNED
 * sample (the full sample minus the categories the board's exclusion rule keeps out).
 * Both are sorted by slug first so every fit is deterministic. This is the single place
 * the samples are drawn; fitCalibration, the leave-one-out test and the forward test all
 * use it, so the out-of-sample tests judge the same samples the base is fitted to.
 */
function liveSamples(snapshot: Snapshot): { full: SnapshotProtocol[]; aligned: SnapshotProtocol[] } {
  const full = snapshot.protocols
    .filter(
      (p) =>
        p.mcap_usd !== null &&
        p.mcap_usd > 0 &&
        p.tvl_usd > 0 &&
        Number.isFinite(p.mcap_usd) &&
        Number.isFinite(p.tvl_usd) &&
        p.change_7d !== null &&
        Number.isFinite(p.change_7d),
    )
    .slice()
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const aligned = full.filter((p) => p.category === null || !EXCLUDED_CATEGORIES.has(p.category));
  return { full, aligned };
}

/**
 * The per-category base levels for a fitted slope: the mean implied intercept per
 * category, shrunk toward the pooled intercept (k=POOLED_PRIOR_COUNT), for categories
 * with at least LEVEL_MIN_N live rows. Returns null when a level fails validation, so
 * the caller can report FAILED instead of publishing a level it cannot defend. This is
 * the single place levels are computed -- fitCalibration calls it for the base, and the
 * out-of-sample tests call it for every refit.
 */
function fitLevels(rows: SnapshotProtocol[], pooledA: number, slope: number): CategoryLevel[] | null {
  const catSums = new Map<string, { n: number; sum: number }>();
  for (const p of rows) {
    const key = p.category ?? '';
    const e = catSums.get(key) ?? { n: 0, sum: 0 };
    e.n += 1;
    e.sum += impliedIntercept(p.tvl_usd, p.mcap_usd as number, slope);
    catSums.set(key, e);
  }
  const levels: CategoryLevel[] = [];
  for (const key of [...catSums.keys()].sort()) {
    const e = catSums.get(key)!;
    if (e.n < LEVEL_MIN_N) continue;
    const aCat = e.sum / e.n;
    const aEff = shrunkIntercept(pooledA, aCat, e.n);
    const level = levelMultiplier(aEff, pooledA);
    if (!Number.isFinite(aCat) || !Number.isFinite(aEff) || !Number.isFinite(level) || level <= 0) {
      return null;
    }
    levels.push({ category: key, n: e.n, a_cat: aCat, a_eff: aEff, level });
  }
  return levels;
}

/** The median of sorted numbers: the middle value, or the mean of the two middle values
 * for an even count. (The in-sample median_resid in olsLog10 takes the upper middle
 * instead; that number is displayed as-is and is left untouched.) */
function medianSorted(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** One out-of-sample score from held-out predictions and their actuals, all in log10
 * market-cap units. R2 is against the mean of the held-out actuals, so a negative R2
 * means the fit predicts worse than the test mean -- reported as it is, not floored. */
function scoreOutOfSample(preds: number[], actuals: number[]): OutOfSample {
  const n = preds.length;
  if (n === 0) return nullOutOfSample();
  const meanActual = actuals.reduce((s, y) => s + y, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  const errs: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = Math.abs(preds[i]! - actuals[i]!);
    errs.push(e);
    ssTot += (actuals[i]! - meanActual) * (actuals[i]! - meanActual);
    ssRes += (preds[i]! - actuals[i]!) * (preds[i]! - actuals[i]!);
  }
  errs.sort((x, y) => x - y);
  const med = medianSorted(errs);
  const mean = errs.reduce((s, e) => s + e, 0) / n;
  const within2x = errs.filter((e) => e <= Math.log10(2)).length / n;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
  return { r2, med, mean, within2x, typ: Math.pow(10, med), n };
}

/**
 * One fit on one set of live rows: the pooled log10 OLS slope and intercept, plus the
 * per-category levels refit on the same rows when `leveled` (the aligned sample's
 * treatment). Returns null when the fit or a level fails validation. The caller picks
 * the intercept a row is predicted with: its category's level when one was earned,
 * else the pooled intercept.
 */
function fitOneSample(
  rows: SnapshotProtocol[],
  leveled: boolean,
): { a: number; b: number; levels: CategoryLevel[] } | null {
  const pts = rows.map((p) => ({ x: Math.log10(p.tvl_usd), y: Math.log10(p.mcap_usd as number) }));
  const fit = olsLog10(pts);
  if (fit.a === null || fit.b === null || fit.r2 === null) return null;
  const levels = leveled ? fitLevels(rows, fit.a, fit.b) : [];
  if (levels === null) return null;
  return { a: fit.a, b: fit.b, levels };
}

/** A row's predicted log10 market cap under a fitted sample: its category's level when
 * the fit earned one, else the pooled intercept, at the pooled slope. */
function predictLogMcap(p: SnapshotProtocol, fit: { a: number; b: number; levels: CategoryLevel[] }): number {
  const aEff = effectiveA(p.category, fit.a, fit.levels);
  return aEff + fit.b * Math.log10(p.tvl_usd);
}

/**
 * Leave-one-out cross-validation: hold each live token out in turn, refit on the rest
 * (levels refit per fold for the aligned sample, pooled only for the full sample), and
 * predict the held-out token. Both fits are scored the same way, so the dashboard shows
 * the choice of sample judged on held-out error. A fold whose refit fails is skipped
 * rather than invented -- and the score then says how many folds it rests on.
 */
function looFit(full: SnapshotProtocol[], aligned: SnapshotProtocol[]): { aligned: OutOfSample; full: OutOfSample } {
  function loo(rows: SnapshotProtocol[], leveled: boolean): OutOfSample {
    const preds: number[] = [];
    const actuals: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rest = rows.slice(0, i).concat(rows.slice(i + 1));
      const fit = fitOneSample(rest, leveled);
      if (fit === null) continue;
      preds.push(predictLogMcap(rows[i]!, fit));
      actuals.push(Math.log10(rows[i]!.mcap_usd as number));
    }
    return scoreOutOfSample(preds, actuals);
  }
  return { aligned: loo(aligned, true), full: loo(full, false) };
}

/**
 * The TVL-split forward test of one sample: sort its live rows by TVL, split into
 * halves, fit on the smaller-TV half and predict the larger half, then reverse.
 * Levels are refit on the TRAIN half only when `leveled`.
 */
function forwardOne(rows: SnapshotProtocol[], leveled: boolean): { small_to_large: OutOfSample; large_to_small: OutOfSample } {
  const byTvl = rows.slice().sort((a, b) => a.tvl_usd - b.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const half = Math.floor(byTvl.length / 2);
  const small = byTvl.slice(0, half);
  const large = byTvl.slice(half);
  function predict(train: SnapshotProtocol[], test: SnapshotProtocol[]): OutOfSample {
    const fit = fitOneSample(train, leveled);
    if (fit === null) return nullOutOfSample();
    return scoreOutOfSample(
      test.map((p) => predictLogMcap(p, fit)),
      test.map((p) => Math.log10(p.mcap_usd as number)),
    );
  }
  return { small_to_large: predict(small, large), large_to_small: predict(large, small) };
}

/**
 * Fit log10(mcap) = a + b x log10(tvl) on the snapshot's live tokens. Rows are sorted by slug
 * first so the fit is deterministic. A fitted point needs a positive finite market cap, a
 * positive finite TVL, and a reported seven-day change: a market cap of zero carries no log,
 * and a row whose growth is unreported is invalid input, never a valid observation. The
 * ALIGNED sample -- the model -- leaves out the categories the board's exclusion rule keeps
 * out; the FULL sample over every live token is fitted the same way and reported beside it.
 * The fit is weak (aligned R2 around 0.10 on this snapshot: the typical live token sits
 * about 3.5x from the fitted line), and the dashboard says so -- the base is a power law
 * calibrated to real market data, not a precise law.
 */
export function fitCalibration(snapshot: Snapshot): Calibration {
  const { full: live, aligned } = liveSamples(snapshot);
  const fullPts = live.map((p) => ({ x: Math.log10(p.tvl_usd), y: Math.log10(p.mcap_usd as number) }));
  const full = olsLog10(fullPts);
  const fullOut = { a: full.a, b: full.b, r2: full.r2, n: live.length };
  if (live.length < CALIBRATION_MIN_N) {
    return failedCalibration(`fewer than ${CALIBRATION_MIN_N} usable live tokens (n=${live.length})`, fullOut);
  }
  if (aligned.length < CALIBRATION_MIN_N) {
    return failedCalibration(`fewer than ${CALIBRATION_MIN_N} usable live tokens after the board's category exclusions (n=${aligned.length})`, fullOut);
  }
  const pts = aligned.map((p) => ({ x: Math.log10(p.tvl_usd), y: Math.log10(p.mcap_usd as number), t: p.tvl_usd, m: p.mcap_usd as number }));
  const excluded = live
    .filter((p) => p.category !== null && EXCLUDED_CATEGORIES.has(p.category))
    .map((p) => ({ t: p.tvl_usd, m: p.mcap_usd as number }));
  const fit = olsLog10(pts);
  if (fit.a === null || fit.b === null || fit.r2 === null || fit.median_resid === null) {
    return failedCalibration('the aligned fit failed validation (no TVL spread, or a non-finite coefficient or R2)', fullOut);
  }
  // Per-category levels: the mcap/TVL relationship is category-specific (within-category
  // univariate R2: Lending 0.37, Dexs 0.32, RWA 0.50, vs pooled 0.10), so categories
  // with enough live rows earn their own intercept -- but the SLOPE stays pooled for
  // every row, and the level is shrunk hard toward pooled. A per-category slope would
  // explode at large TVL (Dexs b=1.78, Lending b=1.50: simulated top $1.09B); an
  // unshrunk intercept lets a single-token category sit 567x off the pooled line. Both
  // were simulated and rejected (see TR-NOTES-v2.md §2). A null category earns no level:
  // no null-category row is in the aligned sample, so the '' group never reaches n≥10.
  const levels = fitLevels(aligned, fit.a, fit.b);
  if (levels === null) {
    return failedCalibration('a category level failed validation', fullOut);
  }
  const loo = looFit(live, aligned);
  const forward: ForwardTest = { aligned: forwardOne(aligned, true), full: forwardOne(live, false) };
  return {
    status: 'ok',
    reason: null,
    a: fit.a,
    b: fit.b,
    r2: fit.r2,
    n: aligned.length,
    median_resid: fit.median_resid,
    points: pts.map((p) => ({ t: p.t, m: p.m })),
    excluded_points: excluded,
    full_a: full.a,
    full_b: full.b,
    full_r2: full.r2,
    full_n: live.length,
    levels,
    loo,
    forward,
  };
}

/** How many protocols record a CoinGecko id or a symbol but no market cap: they have a ticker
 * on record, so the board keeps them out, and the dashboard states the count. */
export function countTickerNoMcap(snapshot: Snapshot): number {
  return snapshot.protocols.filter((p) => p.mcap_usd === null && (p.gecko_id !== null || p.symbol !== null)).length;
}

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    base_usd: number;
    a_eff: number;
    growth_pct: number;
    growth_multiplier: number;
    confidence: number;
    tvl_prev_usd: number;
    invalid_growth: boolean;
    maturity_multiplier: number;
    chain_multiplier: number;
    category_multiplier: number;
    category_launch_rate: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, farm plan included. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_usd: number;
  a_eff: number;
  growth_pct: number;
  growth_multiplier: number;
  confidence: number;
  tvl_prev_usd: number;
  invalid_growth: boolean;
  maturity_multiplier: number;
  chain_multiplier: number;
  category_multiplier: number;
  category_launch_rate: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One rankable protocol the board does NOT rank: it is above the watchlist floor and
 * not in the sealed watchlist, so the coverage rule (watchlist + rankable below the
 * floor) leaves it out. The dashboard discloses all of them with the implied value
 * each WOULD carry under the same model -- including when that value would outrank
 * the board's top rows. The reason is the floor rule alone: no row here fails the
 * rankable rule, and the board does not judge whether a name reads as a sub-product
 * or a wrapper of a larger protocol. */
export interface ExcludedRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  implied_value_usd: number;
}

/** The rankable protocols above the watchlist floor that are not in the sealed
 * watchlist, strongest implied value first, with the counts of how many would enter
 * the board's top 10 and top 40. Scored with the same impliedValue as the board, so
 * the disclosed values are the model's own, not a second model. */
export function excludedAboveFloor(
  snapshot: Snapshot,
  model: ModelConstants,
  rates: { byCategory: Map<string, number>; global: number },
  calibration: Calibration,
  board: BoardRow[],
): { rows: ExcludedRow[]; top10: number; top40: number } {
  const onBoard = new Set(board.map((r) => r.slug));
  const rows: ExcludedRow[] = [];
  for (const p of snapshot.protocols) {
    if (onBoard.has(p.slug)) continue;
    if (!isRankable(p)) continue;
    if (p.tvl_usd < snapshot.floor_usd) continue;
    const v = impliedValue(p, snapshot.as_of, model, rates, calibration);
    rows.push({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, implied_value_usd: v.implied });
  }
  rows.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const top10Line = board.length >= 10 ? board[9]!.implied_value_usd : 0;
  const top40Line = board.length >= 40 ? board[39]!.implied_value_usd : 0;
  return {
    rows,
    top10: rows.filter((r) => r.implied_value_usd >= top10Line).length,
    top40: rows.filter((r) => r.implied_value_usd >= top40Line).length,
  };
}

/** Everything the dashboard needs: the board, the live set, the calibration, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  ticker_no_mcap: number;
  launch_rate_global: number;
  launch_rate_mcap_only: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  excluded: ExcludedRow[];
  excluded_top10: number;
  excluded_top40: number;
  farm_verdicts: { farm: number; thin: number; skip: number };
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule keeps out: exchanges, bridges, liquid staking and restaking. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token and none of the watchlist rule's
 * exclusions (exchange, bridge / liquid-staking / restaking category, versioned name, wrapped or
 * staked product, exchange-name prefix). The rule uses only the snapshot's own ten fields.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/**
 * The category launch rate: the share of a category's protocols that already trade a token,
 * counted from this snapshot. A category with too few protocols, or a null category, falls back
 * to the global rate, so no small sample swings a row.
 */
export function categoryLaunchRates(snapshot: Snapshot): { byCategory: Map<string, number>; global: number } {
  const counts = new Map<string, { live: number; pre: number }>();
  let liveTotal = 0;
  for (const p of snapshot.protocols) {
    const key = p.category ?? '';
    const entry = counts.get(key) ?? { live: 0, pre: 0 };
    if (isPreToken(p)) entry.pre += 1;
    else {
      entry.live += 1;
      liveTotal += 1;
    }
    counts.set(key, entry);
  }
  const global = snapshot.protocols.length > 0 ? liveTotal / snapshot.protocols.length : 0.5;
  const byCategory = new Map<string, number>();
  for (const [key, entry] of counts) {
    const total = entry.live + entry.pre;
    byCategory.set(key, total >= MODEL.min_category_protocols ? entry.live / total : global);
  }
  return { byCategory, global };
}

/** The launch rate a protocol's category gets, with the global fallback. */
export function launchRateFor(p: SnapshotProtocol, rates: { byCategory: Map<string, number>; global: number }): number {
  const key = p.category ?? '';
  return rates.byCategory.get(key) ?? rates.global;
}

/** The intercept a row is scored with: its category's shrunk level when the category
 * earned one (at least LEVEL_MIN_N live rows in the aligned sample), else the pooled
 * intercept. The lookup is by exact category name, never by substring: a category
 * called 'Uncollateralized Lending' is not 'Lending'. The slope is pooled for every
 * row, so only the intercept moves. */
function effectiveA(category: string | null, pooledA: number, levels: CategoryLevel[]): number {
  const key = category ?? '';
  for (const l of levels) if (l.category === key) return l.a_eff;
  return pooledA;
}

/** The five multipliers and the implied value one protocol gets under `model`. The base is
 * the fitted power law: 10^a_eff x tvl^b, where a_eff is the row's category level when
 * its category earned one, else the aligned calibration's pooled a; the slope b is the
 * aligned calibration's for every row. Growth is confidence-weighted: the week's change
 * counts only as far as the protocol was already big before it (tvl_prev / floor), so a
 * spike from below the snapshot's floor cannot decide a rank. A null change counts as 0
 * AND raises the invalid-growth flag: M_g is 1.0 and the row is flagged on the board.
 * The base is rounded to WHOLE DOLLARS first, and the implied value is scored from that
 * rounded base, never from the unrounded fit: board, data.js and the page all use the
 * same whole-dollar number, so the page's recompute matches the board's exactly. An
 * independent full-precision recompute from the dashboard's a/b may differ by at most $1
 * per row -- that is the rounding, not a bug. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  rates: { byCategory: Map<string, number>; global: number },
  calibration: Calibration,
): {
  implied: number;
  base: number;
  aEff: number;
  growthPct: number;
  growthMult: number;
  confidence: number;
  tvlPrev: number;
  invalidGrowth: boolean;
  maturityMult: number;
  chainMult: number;
  catMult: number;
  catRate: number;
  age: number | null;
} {
  if (calibration.status !== 'ok' || calibration.a === null || calibration.b === null) {
    throw new Error(`token radar: the calibration failed (${calibration.reason ?? 'no reason'}): no base, no board`);
  }
  const age = ageDays(asOf, protocol.listed_at);
  const invalidGrowth = protocol.change_7d === null || !Number.isFinite(protocol.change_7d);
  const rawGrowth = invalidGrowth ? 0 : (protocol.change_7d as number);
  const tvlPrev = rawGrowth <= -100 ? Infinity : protocol.tvl_usd / (1 + rawGrowth / 100);
  const confidence = Number.isFinite(tvlPrev) ? Math.min(1, tvlPrev / model.universe_floor_usd) : 1;
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth)) * confidence;
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = protocol.chains.length;
  const chainMult = 1 + model.chain_step * Math.min(Math.max(chainCount - 1, 0), model.chain_cap);
  const catRate = launchRateFor(protocol, rates);
  const catMult = model.cat_floor + catRate * model.cat_range;
  const aEff = effectiveA(protocol.category, calibration.a, calibration.levels);
  const base = Math.round(Math.pow(10, aEff) * Math.pow(protocol.tvl_usd, calibration.b));
  const implied = Math.max(IMPLIED_MIN_USD, Math.round(base * growthMult * maturityMult * chainMult * catMult));
  return { implied, base, aEff, growthPct, growthMult, confidence, tvlPrev, invalidGrowth, maturityMult, chainMult, catMult, catRate, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const rates = categoryLaunchRates(snapshot);
  const calibration = fitCalibration(snapshot);
  if (calibration.status !== 'ok') {
    throw new Error(`token radar: the calibration failed (${calibration.reason ?? 'no reason'}): no base, no board`);
  }
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor. A chosen
  // protocol stays chosen; the board is the watchlist plus the whole early set, not a top-N cut.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model, rates, calibration);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      base_usd: s.v.base,
      a_eff: s.v.aEff,
      growth_pct: s.v.growthPct,
      growth_multiplier: s.v.growthMult,
      confidence: s.v.confidence,
      tvl_prev_usd: s.v.tvlPrev,
      invalid_growth: s.v.invalidGrowth,
      maturity_multiplier: s.v.maturityMult,
      chain_multiplier: s.v.chainMult,
      category_multiplier: s.v.catMult,
      category_launch_rate: s.v.catRate,
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > FARM_STEP_MAX_CHARS) s = `${s.slice(0, FARM_STEP_MAX_CHARS - 4)}...`;
  if (s.length < FARM_STEP_MIN_CHARS) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * The gas a setup step costs, from the position's size and the chain it runs on.
 * Ethereum mainnet is dollars per transaction; every other first chain the board
 * ranks on is a layer-2 or an alt-L1 where the same transaction costs cents.
 */
function gasFor(capital: number, chain: string): string {
  if (chain !== 'Ethereum') return 'a few cents of gas';
  return capital >= 150 ? 'about $8 of gas' : 'about $4 of gas';
}

/**
 * The category's main action, in the words a farmer can follow. The lookup is by category
 * substring, never by protocol name: every protocol in a category gets the same kind of action.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield aggregator') || c.includes('yield')) return `Deposit $${capital} of USDC into ${name}'s highest-yield vault on ${chain} and keep the shares.`;
  if (c.includes('leveraged farm') || c.includes('leveraged')) return `Open a $${capital} leveraged position on ${name} on ${chain} at low leverage and keep it open.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking pool') || c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa') || c.includes('basis trad')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('liquid')) return `Deposit $${capital} of the liquid asset into ${name} on ${chain} and keep the receipt.`;
  if (c.includes('farm')) return `Stake $${capital} of LP tokens in ${name}'s farm on ${chain} and keep the position open.`;
  if (c.includes('payment') || c.includes('card')) return `Load $${capital} onto ${name} on ${chain} and make one real payment through it.`;
  if (c.includes('chain')) return `Use $${capital} of ${name} on ${chain}: send one transaction through its app and keep the balance.`;
  if (c.includes('governance')) return `Deposit $${capital} of USDC into ${name} on ${chain} and vote once with the position.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index on ${chain} and hold the shares.`;
  if (c.includes('otc') || c.includes('marketplace')) return `Place one $${capital} order through ${name} on ${chain} and settle it.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action, again by category, never by name. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'a supply, a borrow, a repay or a rate check';
  if (c.includes('dex')) return 'a swap, a liquidity add or a liquidity removal';
  if (c.includes('yield')) return 'a vault deposit, a withdrawal or a claim of rewards';
  if (c.includes('bridge') || c.includes('cross chain')) return 'a bridge transfer or a use of the bridged funds';
  if (c.includes('staking') || c.includes('restak')) return 'a stake, an unstake or a reward claim';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'a trade, a hedge adjustment or a margin top-up';
  if (c.includes('prediction')) return 'a market position or a settlement check';
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'a vault deposit, a rebalance or a vote';
  if (c.includes('stable')) return 'a mint, a redeem or a transfer of the stable asset';
  if (c.includes('rwa') || c.includes('basis trad')) return 'a mint, a hold check or a yield claim';
  if (c.includes('insurance')) return 'a cover check or a claim filing';
  if (c.includes('governance')) return 'a vote or a proposal read';
  return 'a deposit, a swap, a borrow or a vote';
}

/**
 * The pre-deposit check, by category. For curated vaults it cites the venue's real warning
 * flags as the example of what to look for: Morpho's vault pages flag not_whitelisted,
 * deposit_disabled and low_liquidity (docs.morpho.org), and a deposit cap can sit at zero,
 * so a capped vault takes no deposit at all. The step is an instruction to check the live
 * page at execution time -- no vault is named here, and no claim is made about any single
 * vault's state. The ">95% fall" wording is a vault-data provider's warning text, not
 * Morpho's own vocabulary, so the step phrases it generically. For every other category
 * the check is the same shape without a named venue.
 */
function checkFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return `Before you deposit, open the vault on the venue's own page and check it carries no warning flag, its deposits are not capped, and its value has not fallen far from its peak. Morpho's vault pages, for example, flag not_whitelisted, deposit_disabled and low_liquidity. Skip a vault that fails any of these and pick another from the same curator.`;
  }
  return `Before you deposit, open the protocol's own page and check the pool or vault is still open, its value has not fallen far from its peak, and it carries no warning. Skip it if any of these fail.`;
}

/**
 * The setup gas as a NUMBER: the same rule the plan's step 2 states in words
 * (Ethereum: about $8 when the capital is $150 or more, about $4 below it; every
 * other first chain: a few cents, counted here as $0.10). The net math needs a
 * number, so the words get one -- and the dashboard's mirror uses the same number.
 */
function setupGasUsd(capital: number, chain: string): number {
  if (chain !== 'Ethereum') return 0.1;
  return capital >= 150 ? 8 : 4;
}

/** A farm plan's verdict, from its break-even APY: the APY the position would need to
 * earn for the assumed yield to cover the gas. FARM at 100% or less, THIN at 200% or
 * less, SKIP above that. Every plan nets negative on yield alone at the assumed 4%,
 * so the verdict is about relative cost, not profit: the farm is a bet on the token,
 * not on the yield. */
export type FarmVerdict = 'farm' | 'thin' | 'skip';

export interface FarmPlanSummary {
  yieldUsd: number;
  gasUsd: number;
  netUsd: number;
  breakEvenApy: number;
  verdict: FarmVerdict;
}

/** Net one farm plan against its own costs: the assumed 4% yield on the capital over
 * the hold, minus the setup gas plus $2 of gas a week over the hold. */
export function farmPlanSummary(capital: number, hold: number, chain: string): FarmPlanSummary {
  const yieldUsd = (capital * 0.04 * hold) / 365;
  const gasUsd = setupGasUsd(capital, chain) + (2 * hold) / 7;
  const netUsd = yieldUsd - gasUsd;
  const breakEvenApy = (gasUsd / capital) * (365 / hold) * 100;
  const verdict: FarmVerdict = breakEvenApy <= 100 ? 'farm' : breakEvenApy <= 200 ? 'thin' : 'skip';
  return { yieldUsd, gasUsd, netUsd, breakEvenApy, verdict };
}

/**
 * The yield check. The yield is an ASSUMPTION for the break-even math, not a promise: 4%
 * a year, stated as such. The arithmetic is the farmer's own -- the capital and the hold
 * come from this protocol's record -- and the vault's actual rate is read off its own page
 * at deposit time. No APY is cited: real vault rates on the same pages run from 0% to
 * four figures, which is exactly why the plan assumes a rate instead of quoting one.
 * The step then nets the plan against its own costs -- the setup gas from step 2 and
 * $2 a week from step 6 -- and states the net, the break-even APY and the verdict.
 * At the assumed 4% every plan nets negative, so the verdict is about relative cost.
 */
function yieldFor(capital: number, hold: number, chain: string): string {
  const example = (capital * 0.04 * hold) / 365;
  const net = farmPlanSummary(capital, hold, chain);
  const netStr = net.netUsd < 0 ? `-$${Math.abs(net.netUsd).toFixed(2)}` : `$${net.netUsd.toFixed(2)}`;
  const gloss =
    net.verdict === 'farm' ? 'the cheapest kind of plan to hold' : net.verdict === 'thin' ? 'hold a small position only' : 'the gas costs far more than the yield';
  return `Assume a net yield of 4% a year for the break-even math: $${capital} at an assumed 4% for ${hold} days earns $${capital} x 0.04 x ${hold}/365, about $${example.toFixed(2)}. That 4% is an assumption, not a promise -- read the vault's actual rate off its own page. Netted: $${net.gasUsd.toFixed(2)} of gas all in ($${setupGasUsd(capital, chain).toFixed(2)} to set up, $2 a week for ${hold} days); the yield nets ${netStr} after gas and breaks even at ${net.breakEvenApy.toFixed(0)}% a year. Verdict: ${net.verdict} -- ${gloss}.`;
}

/**
 * The risks, kept apart from the costs: a step of its own, so a reader never mistakes a
 * risk for a fee. Category-flavoured where the category earns it, generic otherwise. None
 * of these risks is removed by reading the plan.
 */
function riskFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return `Risks, separate from the costs above: the curator can change allocations or raise fees behind a timelock; a vault's markets can carry bad debt; withdrawals can wait when markets are fully borrowed; a smart-contract bug can lose funds. Reading this plan removes none of these risks.`;
  }
  return `Risks, separate from the costs above: the protocol's contracts can carry bugs; its assets can lose value or liquidity; withdrawals can wait when funds are fully deployed; an incentive program can end without notice. Reading this plan removes none of these risks.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age), never from a hand-written
 * list of names. Step 1 is the same safety step for every protocol; steps 2 to 4 follow its
 * category (the action, the pre-deposit check, the yield arithmetic as a labeled assumption);
 * step 5 states the risks apart from the costs; step 6 is the weekly action; step 7 is the
 * age-derived hold (the snapshot-counting is a working assumption, labeled as one); step 8
 * is the claim check -- it only ever says to check the protocol's official page for a
 * rewards or points program, never that one exists -- and the farm log.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  const weekly = weeklyFor(p);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gasFor(capital, chain)}`,
      time: '15 minutes to set up',
    },
    {
      text: checkFor(p),
      cost: 'nothing to check',
      time: '10 minutes',
    },
    {
      text: yieldFor(capital, hold, chain),
      cost: 'nothing to check; the 4% is an assumption, the vault page states its rate',
      time: '5 minutes',
    },
    {
      text: riskFor(p),
      cost: 'nothing to read; the risk is the capital itself, not a fee',
      time: '10 minutes',
    },
    {
      text: `Make one action each week, such as ${weekly}.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days. A longer hold keeps the position visible across snapshots -- a working assumption, not a rule any protocol publishes.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, check the protocol's official page for any rewards or points program -- if it publishes none, there is none to claim -- and claim only from a link the official page itself publishes. Never pay to claim. Then write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. The farm plan is carried, not regenerated
 * in the page (radar-4): the strings are the model's own, written by main.ts from the
 * same farmSteps that board.json carries, so the dialog shows exactly what the board
 * holds. The base is rounded to whole dollars and stored IDENTICALLY here and in
 * board.json, and the implied value is scored from that rounded base: the page's
 * recompute matches the board's number exactly; an independent full-precision
 * recompute from the dashboard's a/b may differ by at most $1 per row. The
 * multipliers, the confidence and the category rate are kept at full precision.
 * `tvl_prev_usd` is Infinity for a protocol whose week fell 100% or more; JSON writes it as
 * null, and the page recomputes it from the TVL and the change, so the stored copy is
 * display-only. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_usd: row.model.base_usd,
    a_eff: row.model.a_eff,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    confidence: row.model.confidence,
    tvl_prev_usd: row.model.tvl_prev_usd,
    invalid_growth: row.model.invalid_growth,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    category_multiplier: row.model.category_multiplier,
    category_launch_rate: row.model.category_launch_rate,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const calibration = fitCalibration(snapshot);
  const rates = categoryLaunchRates(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const excluded = excludedAboveFloor(snapshot, model, rates, calibration, board);
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  const bySlugMap = bySlug(snapshot.protocols);
  for (const r of board) {
    const p = bySlugMap.get(r.slug)!;
    const s = farmPlanSummary(capitalFor(p), holdDaysFor(r.age_days), chainOf(p));
    verdicts[s.verdict] += 1;
  }
  const withMcap = snapshot.protocols.filter((p) => p.mcap_usd !== null).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    ticker_no_mcap: countTickerNoMcap(snapshot),
    launch_rate_global: rates.global,
    launch_rate_mcap_only: snapshot.protocols.length > 0 ? withMcap / snapshot.protocols.length : 0,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
    excluded: excluded.rows,
    excluded_top10: excluded.top10,
    excluded_top40: excluded.top40,
    farm_verdicts: verdicts,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/**
 * Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied
 * value, farm steps, exclusion violations, duplicate slugs and value bounds.
 */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set<string>();
  for (const r of board) {
    if (slugs.has(r.slug)) return `duplicate slug ${r.slug}`;
    slugs.add(r.slug);
  }
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const bySlugMap = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  for (const r of board) {
    const p = bySlugMap.get(r.slug);
    if (p === undefined) return `${r.slug} is not in the snapshot`;
    if (!isRankable(p)) return `${r.slug} is not rankable: it fails the board's own exclusion rule`;
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < FARM_STEP_MIN_CHARS || s.length > FARM_STEP_MAX_CHARS) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd < IMPLIED_MIN_USD || r.implied_value_usd > IMPLIED_MAX_USD) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.name.trim().length === 0) return `${r.slug} has an empty name`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
