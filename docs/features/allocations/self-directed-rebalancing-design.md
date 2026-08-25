# Self-Directed Rebalancing — Design Document

Status: Draft for review Date: 2026-08-19 Authors: @Jonjon-prog Reviewers:
@afadil, @marcoscale98 Context:
[PR #1486](https://github.com/wealthfolio/wealthfolio/pull/1486) discussion
Supersedes: parts of `sota-target-model-spec.md` §6.6 and §5.4 (noted inline)

---

## 1. Why this document

PR #1486 opened a wider question: does automated rebalancing put Wealthfolio in
the territory of regulated investment advice? @afadil proposed reducing the
feature to a fully manual worksheet. The thread converged instead on a narrower
change, summarised in his seven-point direction (2026-08-18):

1. Merge #1486 (user chooses eligible holdings).
2. Keep drift, cash, bands, turnover, minimum size, whole-share math.
3. Let the user choose how adjustments are split between eligible holdings.
4. Start with one rule: keep current proportions.
5. Show results as **calculated adjustments**, not "proposed trades".
6. Every adjustment editable, user review required.
7. No ranking of securities, no "best investment" claims.

This document turns that into a concrete design: what changes in the engine, in
the output, in the copy, in the export, and in the AI assistant.

**Agreed in thread (2026-08-24).** @afadil confirmed four decisions that this
document treats as settled:

1. The first supported allocation rule is _keep current proportions_.
2. The user explicitly chooses eligible securities and accounts.
3. The app performs no ranking, suitability assessment, or **hidden selection**.
4. The result is editable arithmetic, not a recommended plan.

Decision 2 has an open reading on the account side, tracked in §16.

---

## 2. The test we design against

The clearest formulation is FCA PERG 8.30A on filtering tools: a filter based on
**factual criteria** is not regulated advice; a filter incorporating **opinion,
judgment or ranking** is.

So the question is never "does the tool output numbers". It is **who supplied
the judgment**. Every decision below is derived from that single test:

| Input                                    | Who supplies judgment | Verdict             |
| ---------------------------------------- | --------------------- | ------------------- |
| Target weights per asset class           | User                  | Keep                |
| Bands, triggers, turnover cap, min trade | User                  | Keep                |
| Drift arithmetic                         | Nobody (math)         | Keep                |
| Which security to buy inside a sleeve    | **Wealthfolio today** | **Change**          |
| Which account to buy in                  | **Wealthfolio today** | **Make mechanical** |
| Named strategy presets                   | **Wealthfolio today** | **Change**          |
| Ranking sells by tax outcome             | Would be Wealthfolio  | Never build         |

Two supporting facts, currently stated nowhere in the product:

- **Local-first.** The calculation runs on the user's machine; the portfolio
  never reaches us. "Advising others" presupposes an other who receives the
  data.
- **No execution, no custody, no discretion, no order routing**, and AGPL source
  anyone can audit.

A "not financial advice" line stays, but it is not load-bearing: ESMA and the
FCA assess substance over form.

---

## 3. Goals

- Keep the drift → plan loop useful for a passive investor with a written
  target. Losing that loop is the failure mode.
- Move every judgment call structurally to the user — not by disclaimer.
- Keep the UX cost near zero: one extra dropdown, configured once.
- Keep the engine auditable: every output line shows its own arithmetic.
- Stay addon-friendly: anything opinionated (tax rules, substitution universes,
  scoring) lives outside core.

## 4. Non-goals

- Order routing, execution, custody, discretionary management.
- Tax-aware sell ordering (loss-first, HIFO, wash-sale logic) inside core. This
  is judgment and it is regulated separately.
- Asset-location optimisation (choosing a tax wrapper for the user).
- Security ranking, scoring, screening by merit, "cheapest eligible ETF",
  substitute-equivalence between funds.
- Backtests, expected returns, risk labels, forward-looking claims anywhere near
  a target.
- Suitability questionnaires or risk profiling.
- Geo-gating by jurisdiction. Rejected: circumventable under AGPL, contradicts
  local-first, and constitutes an admission that can be used against us.
- Replacing the greedy with an MILP optimiser (unchanged from
  `rebalance-algorithm.md` §2).

---

## 5. What ships today

Grounded in `crates/core/src/portfolio/allocation_targets/`:

- `rebalance_service.rs` builds buy candidates from **all** classified non-cash
  holdings, and sell candidates per holding (account-aware).
- `optimizer.rs` (`DriftPriorityOptimizer`) runs an exposure-aware greedy: it
  picks **which candidate** best reduces drift per unit of cash. This is the
  selection step at issue.
- Buy trades are emitted with `account_id: None` (`optimizer.rs:1140`, `:1183`).
  Sell trades carry the source holding's account (`optimizer.rs:557`) — that one
  is already factual.
- `SuggestedManualTrade` carries `action: "buy" | "sell"`, `quantity`,
  `estimated_price`, `estimated_amount`, `reason` (`model.rs:439`).
- Constraints from #1177 (do-not-sell asset/account, `max_turnover_bps`) already
  gate sells.
- Copy says "Proposed trades" (`allocation.rebalance.proposedTrades`,
  `allocation.copyText.proposedTrades`), and the CSV exports
  `Action / Symbol / Shares` columns.
- Presets:
  `apps/frontend/src/pages/allocation-targets/components/model-preset-data.ts`
  ships named strategies with `risk` and `featured` fields ("All Weather",
  "Diversified across market regimes", risk "Conservative").

So the delta is smaller than the thread suggests: the engine stays, the
**selection step** and the **presentation layer** change.

---

## 6. Split-rule ladder

Replaces the within-sleeve selection in `DriftPriorityOptimizer` and supersedes
`sota-target-model-spec.md` §6.6 steps 1 and 3.

Two stages, both arithmetic:

**Stage A — budget per sleeve.** Unchanged. Cash (and sell proceeds) go to
sleeves by drift, using the user's targets, bands, `rebalance_to` and turnover
cap. Ordering sleeves by drift is arithmetic on the user's own target, not a
merit ranking.

**Stage B — split inside the sleeve.** Rungs, in resolution order:

| Rung | Rule                                       | Who chose the instrument      |
| ---- | ------------------------------------------ | ----------------------------- |
| 0    | Sleeve-level only (no instrument)          | Nobody — user decides off-app |
| 1    | Keep current proportions                   | User's existing portfolio     |
| 2    | Eligible holdings filter (#1486)           | User's allowlist              |
| 3    | Instrument targets inside the sleeve (§12) | User, explicitly, once        |

Rung 1 is the default and the only one that needs to exist on day one. Rung 2
narrows the set that rung 1 operates on. Rung 3 replaces the split entirely for
that sleeve and is specified in §12 — it is not a separate mechanism. Rung 0 is
the fallback when the set is empty.

### 6.1 Math

For sleeve `c`:

```
sleeve_gap(c)  = target_bps(c)/10000 × planning_total − current_value(c)
eligible(c)    = holdings allowed by the user, with exposure to c and a known price
weight_i       = value_i,c / Σ_j value_j,c    // value_i,c = holding i's value attributed to c
adjustment_i   = sleeve_gap(c) × weight_i
```

`value_i,c` reuses the existing exposure vectors, so a global ETF classified 60
% US / 40 % international keeps contributing to both sleeves as it does today.

Resolution:

- `Σ value_j,c = 0` (no eligible holding in the sleeve) → **rung 0**: emit one
  sleeve-level line with the amount and no instrument. Today's `NoBuyCandidate`
  warning path becomes a first-class output, not a warning.
- Instrument targets set for the sleeve → the weights come from §12.3 instead of
  the current proportions; a sleeve fully covered by instrument targets never
  reaches this formula.
- Sells: same proportional rule across sellable holdings in the overweight
  sleeve, after #1177 constraints. **No tax ordering** — this deletes
  `sota-target-model-spec.md` §6.6 sell sort steps (loss-first, long-term-first,
  highest cost basis). User priority and a deterministic tiebreak only.

### 6.2 Consequences we accept

- **Cross-sleeve spill.** A multi-category holding bought for sleeve A moves
  sleeve B too. Today's greedy iterates to exploit that; proportional splitting
  does not. Result: plans can be marginally less drift-optimal than today. This
  is the real cost of the change and we take it. Mitigation: keep
  `after_bps_by_category` (already computed) as the source of truth for the
  projection, and add a warning kind when a buy pushes another sleeve out of
  band.
- **No redistribution after rounding.** Whole-share flooring and
  `min_trade_amount` drops leave residual cash. It stays in `cash_remaining` and
  is reported. Redistributing it means choosing again.
- **Line ordering is presentation, not ranking.** Sleeves by drift descending,
  instruments by symbol ascending — documented as such in the UI so it is not
  read as a preference order.

### 6.3 Rejected rungs

- "Cheapest eligible ETF" (`sota-target-model-spec.md` §5.4) — a merit filter,
  i.e. exactly what PERG 8.30A catches.
- Substitute groups / equivalent-fund sets — an equivalence claim between two
  instruments is judgment. Addon territory if anyone wants it.
- Auto-suggesting the eligible set from the portfolio ("we picked your broad
  ETFs") — the allowlist must be user-authored. Default = all holdings, which is
  a fact, not a selection.

### 6.4 Eligible set: scope and persistence

Three points #1486 leaves open, all additive to it:

- **Buys only.** The eligible set gates buy candidates. Sells are already
  governed by the do-not-sell / avoid-selling constraints from #1177, and two
  overlapping mechanisms for the same decision would be confusing. A holding can
  therefore be excluded from buys while remaining sellable — which is what "I
  don't want to add to this position" usually means.
- **All scenarios.** #1486 applies the allowlist in Cash-flow only and drops it
  for Sell to rebalance and Hybrid (guard in `rebalance_service`, mirrored in
  the hook). Once the split rule of §6.1 lands, the eligible set is the
  denominator of that split in every scenario, so the guard widens with M2.
- **Persisted on the profile.** #1486 keeps exclusions session-only. §11's
  export header states "eligible holdings (n of m)", and a saved plan has to
  recompute identically, so the set must live on the target profile. Reuse
  `allocation_target_constraints` (#1177) with an asset-scoped exclude-from-buys
  action rather than adding a table.

### 6.5 Adding rules later

_Keep current proportions_ is the first rule, not the last one. Any further rule
is acceptable if it passes §2: it must be arithmetic over inputs the user
authored, and the user must select it explicitly. "Equal weight across eligible
holdings" qualifies. "Buy whichever is furthest below its 200-day average" does
not.

---

## 7. Output: sleeve-level vs instrument-level

The primary figure is the **sleeve amount**, with its arithmetic visible:

```
Fixed income   target 40% × 120 000 = 48 000 − current 41 200 = 6 800 short
  └ AGGH   62%   4 216      (current proportions, 2 eligible holdings)
  └ IEAC   38%   2 584
```

Rules:

- The sleeve line is always rendered. Instrument lines are rendered only when a
  rung resolves them; otherwise the sleeve line stands alone.
- Every line is editable, in amount. Editing recomputes the projection, never
  re-selects instruments.
- The projection panel (current → projected → target → difference) is the output
  that matters, and it is descriptive by construction. This is @afadil's
  worksheet, reached from the other end.
- **Pull, not push.** Results appear only after an explicit _Calculate_ (already
  true today), and a **Fill from drift** button on an otherwise empty worksheet
  lets the user pull the numbers rather than receive them. Same arithmetic,
  different posture, one button.
- Each result panel carries a short methodology block (inputs used, rule
  applied, limitations), modelled on FINRA Rule 2214's disclosure pattern for
  investment analysis tools.

---

## 8. Account attribution

Precision matters here because it sounds pedantic and is not: choosing which
account to buy in is asset location, a tax decision, regulated separately in
several countries (PEA/CTO, TFSA/RRSP, ISA/SIPP, IRA/taxable).

Today buys carry no account at all (`account_id: None`) and sells inherit the
holding's account. So this is less "remove a hidden optimizer" than "make the
missing rule explicit and visible".

**Rule (mechanical, displayed, overridable):**

1. The account that already holds this instrument.
2. If several hold it, the one with the largest current position.
3. Otherwise, the account holding the cash being deployed.
4. Otherwise, unassigned — the user picks.

Displayed verbatim next to the results ("Buys are attributed to the account that
already holds the instrument, otherwise the account holding the cash"), with a
dropdown on every line. Sells keep the source-holding account, which is a fact.

**Never** an input to this rule: account type, tax wrapper, contribution room.
Note for implementers: `crates/agent-tools/src/tools/contribution_limits.rs`
exists — it must not be wired into attribution.

This is the softer reading of thread decision 2 ("the user explicitly chooses
eligible securities and accounts"): a displayed, overridable default is still
the user's choice, and it costs a single-account user zero clicks. The stricter
reading — no default, the user picks an account on every line — is tracked in
§16 and is a one-line change to this rule if preferred.

---

## 9. Copy and terminology

Additions to `sota-target-model-spec.md` §7.5. Existing rows there still apply
(Scenario, Cash-flow only, Sell to rebalance, Hybrid, Drift, Out of band).

| Use                        | Avoid                                     |
| -------------------------- | ----------------------------------------- |
| Calculated adjustments     | Proposed trades / Suggested trades        |
| Adjustment                 | Trade / Order                             |
| Eligible holdings          | Recommended holdings                      |
| Split rule                 | Allocation strategy                       |
| Projected allocation       | Optimised allocation                      |
| Starting layout            | Model / Strategy preset                   |
| Amount short / Amount over | Shortfall to fix                          |
| (nothing)                  | Recommended, optimal, best, should, ideal |

Keys to change: `allocation.rebalance.proposedTrades`,
`allocation.copyText.proposedTrades`, `allocation.result.trades`,
`allocation.result.reviewTrades`, `allocation.trades.*`,
`allocation.rebalance.tradesSummary*`, plus the 7 locale files.

Amounts become the primary figure; share counts are secondary and labelled
"indicative shares at last price".

`SuggestedManualTrade` should be renamed (`CalculatedAdjustment`) so the wire
format matches the wording — a rename across adapters, worth doing once rather
than leaving "trade" in the API forever.

---

## 10. Named presets

The single place where Wealthfolio supplies judgment rather than arithmetic.
@marcoscale98 flagged it first; it is also the cheapest fix in the discussion.

Change in `model-preset-data.ts` / `model-preset-picker.tsx`:

- Drop strategy names ("All Weather", "Balanced 60 / 40") and the `risk` field
  ("Conservative", "Aggressive"). Both are characterisations of outcome.
- Drop `featured` — featuring is ranking.
- Drop descriptive claims like "Diversified across market regimes"
  (forward-looking) and "Bond-heavy preservation mix" (outcome claim).
- Keep the layouts as **unnamed starting layouts**, labelled by composition and
  generated from the weights: "60 % Equity / 40 % Fixed income". Order by equity
  weight, not by merit.
- Never: performance figures, backtests, attribution, "reduces your risk".

A layout that says only what it contains supplies no judgment. Alternative
considered — ship zero presets — rejected: the blank-slate cost is high and the
composition label carries no opinion. Flagged as an open question if @afadil
prefers zero.

---

## 11. Export format

Goal: the file should read like a calculator output, not an order ticket.

- Filename `allocation-worksheet-<profile>-<YYYYMMDD>.csv` (not
  "rebalance-plan").
- Header block: generated at, profile, taxonomy, scenario, split rule, eligible
  holdings (n of m), planning total, cash available, currency, max drift
  before/after, one methodology line, one limitations line.
- Columns:
  `Category, Target %, Current %, Current value, Gap, Adjustment amount, Symbol, Name, Account, Indicative shares, Last price, Basis`.
- `Adjustment amount` is **signed** (+ increase, − decrease); the `Action`
  column with Buy/Sell values goes away. `Basis` restates the arithmetic for the
  line.
- Clipboard copy (`copyText.*`) follows the same shape.

---

## 12. Holdings-level targets

@afadil raised holdings-level targets as a risk. It is the opposite: if the user
writes "15 % VWCE" themselves, there is nothing left for us to choose. The split
ladder collapses into the identity function.

This is the strongest compliance posture available to us, so it moves up the
roadmap — from Phase 4-5 item 8 to directly after the split ladder.

### 12.1 Shape: nested under sleeves, not instead of them

Instrument targets live **inside** a sleeve. The user still authors the asset
class layer; they may additionally say how a given sleeve is filled:

```
Equity        60 %
  └ VWCE      70 %   (of the sleeve)
  └ VTI       30 %
Fixed income  40 %   (no instrument targets → split ladder §6)
Cash           0 %
```

A flat ticker-level layout (no sleeves, one list of instruments) was considered
and rejected. Three reasons:

- People reason strategically in asset classes. Moving 60/40 to 50/50 is two
  numbers here; under a flat layout it means rewriting every instrument weight
  by hand.
- A flat layout is the degenerate case of this one (a single sleeve at 100 %),
  so shipping it first would create a migration for no expressive gain.
- Sleeves keep bands, triggers and turnover meaningful at the level where a
  passive investor actually sets policy.

Rung 3 of the split ladder is not a separate feature: a "designated instrument
for this sleeve" is one instrument target at 10000 bps.

### 12.2 Model

New table, a narrowed `sota-target-model-spec.md` §9.4:

```sql
CREATE TABLE allocation_target_holdings (
    id TEXT PRIMARY KEY NOT NULL,
    weight_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    target_bps INTEGER NOT NULL CHECK (target_bps >= 0 AND target_bps <= 10000),
    is_locked INTEGER NOT NULL DEFAULT 0,
    is_buyable INTEGER NOT NULL DEFAULT 1,
    is_sellable INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (weight_id) REFERENCES allocation_target_weights(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
    UNIQUE(weight_id, asset_id)
);
```

`target_bps` is **relative to the sleeve**, not to the portfolio. Two levels of
percentages, each summing to 100 % in its own scope, is how every
model-portfolio tool states it and how users describe it out loud.

Dropped from §9.4 for v1: `min_bps`/`max_bps` (sleeve bands are enough until
someone asks), `buy_priority`/`sell_priority` (user-authored ordering is
legitimate, just not needed yet), and `substitute_group_id` — declaring two ETFs
interchangeable is a judgment, and it is the one field in §9.4 that fails the §2
test.

### 12.3 Resolution rule when the two levels disagree

The sleeve target always wins; instrument targets only divide it.

| Σ instrument bps in sleeve | Behaviour                                                       |
| -------------------------- | --------------------------------------------------------------- |
| 0 (none defined)           | Split ladder §6 applies to the whole sleeve                     |
| = 10000                    | Sleeve amount divided by the instrument weights                 |
| < 10000                    | Covered share divided as written; remainder → split ladder §6   |
| > 10000                    | Rejected at save time with the sum shown; never silently scaled |

Partial sums are allowed on purpose ("60 % of my equity sleeve is VWCE, the rest
I don't mind"). No normalisation happens behind the user's back — silently
rescaling numbers the user typed is the sort of quiet reasoning this whole
document exists to remove. The covered share and the remainder are both shown in
the editor.

### 12.4 Drift

The read model already exists. `DriftHoldingRow` / `DriftHoldingsReport`
(`model.rs:266`, `:288`) already emit one row per holding, carrying
`category_id`, `value`, `current_pct`, `target_pct` and `drift_bps` — but
`target_pct` is currently inherited from the holding's category
(`drift_service.rs:270`).

Change: when the sleeve has instrument targets, `target_pct` for a row comes
from `allocation_target_holdings` instead, expressed portfolio-wide as
`sleeve_bps × holding_bps / 10000`. Rows for holdings in the sleeve without a
target keep the remainder share. Nothing else in the drift pipeline moves.

Bands stay at sleeve level in v1: an instrument row reports drift, but only the
sleeve triggers.

### 12.5 Planner

For a sleeve with instrument targets:

```
sleeve_value_target = sleeve_bps/10000 × planning_total
gap_i               = holding_bps_i/10000 × sleeve_value_target − current_value_i
```

Each `gap_i` becomes a one-hot buy or sell candidate — the exposure vector of a
targeted instrument is resolved by the user's own target, not by the optimizer.
Sleeves without instrument targets keep the §6 behaviour, so both paths coexist
inside one plan. `is_buyable` / `is_sellable` and the #1177 constraints apply
unchanged, as do whole-share rounding and `min_trade_amount`.

Cross-sleeve spill (§6.2) still exists for multi-category instruments and is
reported the same way.

### 12.6 UI

Targets editor: each sleeve row expands into an optional instrument list (asset
picker + bps), collapsed by default and empty by default. The sleeve row shows
the covered share ("70 % of this sleeve is assigned"). A **Prefill from current
holdings** action writes the user's existing proportions into the list as a
starting point — it copies a fact about the portfolio and is labelled as such;
it is never applied automatically.

The rebalance output (§7) needs no new layout: instrument lines already nest
under sleeve lines.

### 12.7 Why this is compliance-complete

Same test as §2, applied to the nested model:

1. Every bps in the tree is typed by the user; nothing is inferred.
2. Prefill copies what the user already owns and requires an explicit click.
3. No merit ordering anywhere — no substitute groups, no cheapest-eligible
   filter, no tax-driven sell order (§4).
4. The two-level conflict rule is arithmetic and displayed (§12.3); nothing is
   rescaled silently.
5. Sleeves left blank fall back to §6, which is itself judgment-free.
6. Output, account attribution, copy and export rules (§7–§11) apply unchanged.
7. The assistant may write instrument targets the user dictates; it must never
   propose them (§13).

---

## 13. AI assistant

The assistant is the biggest amplifier of everything above: it can turn
class-level arithmetic into an instrument-level narrative in one sentence, in
the user's own language, which is exactly what "personal recommendation"
describes.

Current state is defensible: `crates/agent-tools/src/tools/` exposes
`get_asset_allocation` only — no drift tool, no rebalance tool — and
`crates/ai/src/system_prompt.txt:12` already forbids claiming that an
investment, account, allocation or tax treatment is individually suitable.

Rules to hold:

1. Allocation and drift tools may return **sleeve-level rows only**.
2. No tool returns a plan containing instruments, quantities or accounts. If the
   assistant is asked for a plan, it points at the worksheet.
3. The assistant may **write a target the user dictates**; it must not propose
   weights, layouts, eligible-holding sets, or split rules.
4. "What should I buy / is this a good allocation" → the existing redirect at
   `system_prompt.txt:15`.
5. Tool output stays untrusted data (already enforced) — an addon cannot inject
   a recommendation through a tool result.
6. Lock the behaviour with tests: extend `crates/ai/tests/system_prompt.rs` and
   `crates/ai/tests/allowlist.rs` with refusal cases for "pick a fund for my
   bond sleeve", "which account should I buy in", "what target should I set".

---

## 14. Structural posture (product surface)

Cheap, and currently absent. In the allocation feature and the README:

- The calculation runs locally; the portfolio never leaves the device.
- No execution, no custody, no discretion, no order routing, no brokerage
  connection for orders.
- The user authors the target, the eligible holdings and the split rule.
- Source is AGPL and auditable.

Useful comparable for the record: **Passiv** (Canadian) does more than us — user
targets, rebalancing math, and one-click order routing to the brokerage — and is
not registered as an adviser. Banks are a weaker comparable, since they are
registered entities.

---

## 15. Milestones

| #   | Content                                                                                                                                               | Verify                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| M0  | Merge #1486 (eligible holdings) as-is                                                                                                                 | already green                                                                                                |
| M1  | Presets de-named; copy pass (§9); export restructure (§11)                                                                                            | i18n parity test, CSV header snapshot, `pnpm test`                                                           |
| M2  | Split rule = keep current proportions; sleeve-level fallback; spill warning; account rule; eligible set persisted and widened to all scenarios (§6.4) | new `optimizer.rs` tests: proportional split, empty sleeve, spill, rounding residue; eligible set round-trip |
| M3  | AI guardrail tests (§13)                                                                                                                              | `cargo test -p wealthfolio-ai`                                                                               |
| M4  | Instrument targets inside sleeves (§12) — subsumes ladder rung 3                                                                                      | migration up/down, partial-sum resolution, drift + planner tests at instrument level                         |

M1 is independent of everything else and can ship immediately. M4 needs M2 in
place, since any sleeve left without instrument targets falls back to the split
ladder.

---

## 16. Open questions

1. **Account attribution, strict or default (§8).** Thread decision 2 says the
   user explicitly chooses accounts. This document reads that as a mechanical
   default that is displayed and overridable on every line. The stricter reading
   is no default at all. Recommendation: keep the default — it is zero clicks
   for a single-account user, and an overridable rule shown in full is not a
   hidden selection. **Pending @afadil.**
2. **Buy/Sell verbs in-app.** "Calculated adjustments" renames the container. Do
   the line verbs stay `Buy`/`Sell`, or become `Add`/`Reduce`? Recommendation:
   `Add`/`Reduce` in the amounts-first view, since the user places the actual
   order elsewhere. Needs a §7.5 row either way.
3. **Zero presets vs unnamed layouts?** Recommendation: unnamed layouts (§10).
4. **`SuggestedManualTrade` rename** to `CalculatedAdjustment` — breaking change
   across Tauri/server adapters and any addon reading the plan. Do it with M2,
   or leave the wire format alone?
5. **Spill tolerance.** When a proportional buy pushes another sleeve out of
   band, do we warn only, or also cap the line at the amount that keeps the
   other sleeve in band? Capping is arithmetic on the user's own bands, so it is
   defensible — but it is one more step of automatic reasoning.
6. **Partial instrument sums (§12.3).** Recommendation: allow them, remainder
   falls to the split ladder, nothing rescaled silently. The alternative —
   requiring 100 % per sleeve once a single instrument target is set — is
   simpler to explain but forces the user to enumerate a sleeve completely
   before they can pin one line of it.
7. **Instrument-level bands.** v1 keeps bands at sleeve level only; instrument
   rows report drift but do not trigger. Enough, or does a per-instrument band
   belong in v1?
8. **Existing targets.** Users have targets created from named presets. Do we
   migrate those names, or leave them untouched (user-owned after creation)?
9. **Legal sanity check.** A short consult with a securities lawyer would settle
   §2 quickly. It should not block design work — should it block M2 shipping?

---

## 17. References

- FCA PERG 8.30A (filtering tools: factual criteria vs judgment/ranking), PERG
  8.41 (guidance vs advice)
- UK RAO art 53; MiFID II Delegated Regulation 2017/565 art 9 (a personal
  recommendation concerns a **specific financial instrument**)
- ESMA 2023 briefing on investment advice (substance over form)
- FINRA Rule 2214 (disclosure pattern for investment analysis tools)
- CSA 31-342 and SEC 2017 robo-adviser guidance — addressed to **registered**
  advisers running discretionary online advice; with no discretion, custody or
  execution these do not reach us
- Internal: `rebalance-algorithm.md`, `sota-target-model-spec.md` §5.4, §6.6,
  §7.5, `v1-spec.md`, PR #1177 (constraints), PR #1486 (eligible holdings)
