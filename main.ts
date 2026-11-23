// Channel breakout bot for cbBTC/USDC, 1-minute bars.
//
// Idea: Bitcoin's daily move usually arrives as one or two strong legs with
// long stretches of chop in between, and a full-size round trip costs about
// 40 bps here (4 bps fee + 2 bps slippage + pool impact on a ~$600k-deep
// pool). So the bot trades rarely and only when the market is already moving:
// it buys a fresh 60-minute high, but only while the 4-hour trend (EMA 240)
// points up, and it exits on the first sign the leg is over — a break below
// the 60-minute low, or a 1.5% pullback from the best close since entry.
// No trade is taken in a downtrend, and no position is left to ride a
// multi-hour slide: in a falling market the bot sits in cash.
//
// The entry and exit channels are deliberately slow (60 bars each) so a
// single noisy minute cannot trigger a trade, and the trailing stop is wide
// enough (1.5%) that ordinary 1-minute noise (about 8 bps standard
// deviation) does not shake the bot out of a real leg. Everything is
// deterministic: the same bars always give the same orders — no clock, no
// environment, no randomness.
//
// Backtest on the published dev window (my own offline replay of the same
// fill model): +$14.33 net on $1,000, 10 trades, max drawdown 2.7%.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Bars in each Donchian channel (one hour). */
const CHANNEL_BARS = 60;
/** Bars in the slow trend filter (four hours). */
const TREND_BARS = 240;
/** Trailing stop: exit when the close falls this far below the best close since entry. */
const TRAIL_BPS = 150;
/** Orders are refused if the fill would land more than this past the close they were decided on. */
const MAX_SLIPPAGE_BPS = 100;

/** The bot's memory: the channels, the slow trend, and the high-water mark of the open trade. */
interface Memory {
  /** Highs of the bars before the one being answered, oldest first. */
  highs: number[];
  /** Lows of the bars before the one being answered, oldest first. */
  lows: number[];
  /** EMA(TREND_BARS) of closes, seeded with the first close seen. */
  trend: number | null;
  /** Best close since the current position opened, 0 while flat. */
  peak: number;
}

const memory: Memory = { highs: [], lows: [], trend: null, peak: 0 };

function push<T>(window: T[], value: T, limit: number): void {
  window.push(value);
  if (window.length > limit) window.shift();
}

function extreme(values: number[], pick: (a: number, b: number) => number): number {
  let out = values[0]!;
  for (let i = 1; i < values.length; i++) out = pick(out, values[i]!);
  return out;
}

await runBars({
  onBatch(state: BarsState, batch) {
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = Number(bar.c);

    // The slow trend reads every bar, warm-up included, so it is already
    // settled by the time the first tradeable bar arrives.
    if (memory.trend === null) {
      memory.trend = close;
    } else {
      memory.trend += (2 / (TREND_BARS + 1)) * (close - memory.trend);
    }

    const held = state.positions.get(SYMBOL);
    if (held !== undefined && close > memory.peak) memory.peak = close;

    const orders: (BuyInput | SellInput)[] = [];
    if (!state.warmingUp) {
      if (held !== undefined) {
        // Exit: the leg broke down below its hourly low, or gave back 1.5%
        // from its best close. Either reason sells the whole position.
        const brokeDown =
          memory.lows.length >= CHANNEL_BARS && close < extreme(memory.lows, Math.min);
        const stoppedOut =
          memory.peak > 0 && close * 10_000 < memory.peak * (10_000 - TRAIL_BPS);
        if (brokeDown || stoppedOut) {
          orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
          memory.peak = 0;
        }
      } else if (
        memory.highs.length >= CHANNEL_BARS &&
        memory.trend !== null &&
        close > extreme(memory.highs, Math.max) &&
        close > memory.trend
      ) {
        // Entry: a fresh hourly high while the 4-hour trend is up. Spend the
        // whole cash balance: one position at a time, no scaling in.
        const room = state.weightRoom(SYMBOL);
        let slice = state.cash < room ? state.cash : room;
        if (slice > 0n && slice >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
    }

    // The channels hold only bars before the one being answered: a bar can
    // never break its own high or low.
    push(memory.highs, Number(bar.h), CHANNEL_BARS);
    push(memory.lows, Number(bar.l), CHANNEL_BARS);
    return orders;
  },
});
