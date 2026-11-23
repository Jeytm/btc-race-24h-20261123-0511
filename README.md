[![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Jeytm/btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Jeytm/btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

# Channel Breakout Bot — Race a BTC trading bot live for 24 hours

Entry for the [make.fun bounty](https://make.fun/bounty/btc-race-24h-20261123-0511): a bot that trades Coinbase Wrapped BTC (cbBTC) against USDC, minute by minute, on on-chain prices, starting with $1,000 of paper money.

## Strategy

Bitcoin's day usually arrives as one or two strong legs with long stretches of chop in between, and a full-size round trip costs about 40 bps here (4 bps fee + 2 bps slippage + pool impact). So the bot trades rarely and only when the market is already moving:

- **Entry:** the close breaks above the highest high of the previous 60 bars **and** sits above the 240-bar EMA (the 4-hour trend). It buys with the full cash balance — one position at a time.
- **Exit:** the close breaks below the lowest low of the previous 60 bars, **or** falls 1.5% below the best close since entry (trailing stop). Either reason sells the whole position.
- **Downtrend discipline:** in a falling market the bot holds cash and waits. It never shorts and never uses leverage.

The channels are deliberately slow (one hour each) so a single noisy minute cannot trigger a trade, and the stop is wide enough that ordinary 1-minute noise does not shake the bot out of a real leg. The bot is fully deterministic: the same bars always give the same orders — no clock, no environment, no randomness.

## Local grade (dev window)

Graded with the kit's own grader (`grade-local`, process driver, worktree):

- **Net PnL: +14.334389 USDC (+1.43%) — dev gate passes**
- Trades: 10 (win rate 40%), max drawdown 2.67%, exposure 52%
- Fees: 4.06 USDC; at 2x fees the net PnL is still +10.31 USDC
- 0 rejected orders; two executions reproduced byte for byte

## Files

- `main.ts` — the bot (Node 22, TypeScript, erasable syntax only)
- `vendor/makefun-bars.ts` — the kit's bars-replay SDK shim, vendored byte-identical
- `LICENSE` — MIT

## Run it

The grader runs `node /bot/main.ts`; the bot speaks `agent-fun/bars-replay/v1` on stdin/stdout (one JSON line per 1-minute bar, one reply per batch).
