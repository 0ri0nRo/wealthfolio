# Self-Directed Rebalancing — Design Document

Status: Draft for review (revised after #1565 review) Date: 2026-08-25 Authors:
@Jonjon-prog Reviewers: @afadil, @marcoscale98

Builds on
[Allocation Targets V2](https://github.com/wealthfolio/wealthfolio/blob/feature/allocation-worksheet-refactor/docs/features/allocations/v2-spec.md)
and the worksheet implementation on `feature/allocation-worksheet-refactor`.
Both live on that branch and are not on `main` yet, so the links point at the
branch until it lands. Context:
[PR #1486](https://github.com/wealthfolio/wealthfolio/pull/1486) discussion.

---

## 1. Why this document

V2 removed the optimizer and replaced it with a user-authored worksheet that
starts empty. That protects the product, but it also removes the part of the
feature people actually used: not having to work out the amounts by hand.

This document describes the middle ground agreed in #1486. The user supplies the
target, the eligible securities and the allocation rule; the app does the
arithmetic and prefills the worksheet with the result; the user edits and
reviews it before anything leaves the app.

This is a product-risk and architecture decision, not a conclusion about how any
feature is treated by a regulator. Nothing here rests on wording or disclaimers
being sufficient on their own.

**Agreed in thread (2026-08-24).**

1. The first supported allocation rule is _allocate by current holding
   proportions_.
2. The user explicitly chooses eligible securities and accounts.
3. The app performs no ranking, suitability assessment, or hidden selection.
4. The result is editable arithmetic, not a recommended plan.

---

## 2. Design principle

The product boundary from V2 stands: Wealthfolio does not select, rank,
optimize, recommend, or execute investments.

The working rule for every decision below is **who supplied the judgment**.
Arithmetic over inputs the user authored is in scope. Anything that requires an
opinion about which security, which account, or which outcome is better is not.
Applied to this feature:

| Input                                    | Who supplies it        | Verdict           |
| ---------------------------------------- | ---------------------- | ----------------- |
| Target weights per category              | User                   | Keep              |
| Ranges, triggers, turnover cap, min line | User                   | Keep              |
| Difference arithmetic                    | Nobody (math)          | Keep              |
| Eligible securities                      | User                   | Keep (#1486)      |
| Allocation rule                          | User picks from rules  | Keep              |
| Which security inside a category         | The rule, mechanically | Prefill, editable |
| Which account receives an increase       | Only when unambiguous  | §6                |
| Ranking securities or accounts by merit  | Would be the app       | Never build       |

---

## 3. Goals and non-goals

**Goals**

- Keep the difference → worksheet loop useful without the app constructing a
  course of action.
- Reuse the V2 worksheet as-is: position editor, progressive account allocation,
  live portfolio impact, **Review adjustments**, export.
- Keep every calculated figure editable, and keep the arithmetic visible.
- Keep opinionated behaviour (tax rules, substitution universes, scoring)
  outside core.

**Non-goals**

- Order routing, execution, custody, discretionary management.
- Tax-aware ordering of reductions (loss-first, HIFO, wash-sale) in core.
- Asset-location optimisation — choosing a tax wrapper on the user's behalf.
- Security ranking, scoring, merit filters, "cheapest eligible fund",
  substitute-equivalence between funds.
- Backtests, expected returns, risk labels, forward-looking claims.
- Restoring the optimizer. Multi-category construction stays mechanical.

---

## 4. Allocation model

Four steps, in order. Steps 1 and 2 are user choices; steps 3 and 4 describe how
the arithmetic resolves.

### 4.1 Eligible securities

The user chooses which recorded securities may receive changes (#1486). Default
is every recorded security, which is a fact rather than a selection. The app
never proposes a subset.

Eligibility gates **increases**. Reductions stay governed by the existing
do-not-sell and avoid-selling constraints from #1177 — two overlapping
mechanisms for the same decision would be confusing, and "I don't want to add to
this position" is a different intent from "I don't want to sell it".

### 4.2 Security allocation rule

One rule ships first: **Allocate by current holding proportions**. The user
selects it explicitly; it is not a default that happens invisibly.

For category `c`:

```
category_gap(c)  = target_bps(c)/10000 × planning_total − current_value(c)
eligible(c)      = eligible securities with exposure to c and a usable price
weight_i         = value_i,c / Σ_j value_j,c   // value_i,c = security i's value attributed to c
intent_i,c       = category_gap(c) × weight_i
```

Further rules may be added later if each one is arithmetic over user-authored
inputs and is selected explicitly. "Equal weight across eligible securities"
would qualify. "Whichever security is furthest below its 200-day average" would
not.

### 4.3 Optional instrument targets

Where a user has stated how a category should be filled, that statement replaces
the rule for that category. This is future work (§9) and no behaviour depends on
it in the first release.

### 4.4 Unresolved category amount

When a category has no eligible security — nothing recorded, everything
excluded, no usable price — the amount is not forced onto an unrelated security.
It is surfaced as an **unresolved amount for that category**, shown next to the
category and excluded from the projected figures until the user acts on it. The
current `NoBuyCandidate` warning becomes this first-class output.

### 4.5 Combining categories, then recalculating

A security classified across several categories receives one intent per
category. Those are combined before anything is shown:

```
adjustment_i = Σ_c intent_i,c
```

The projected allocation is then recalculated **from the combined per-security
amounts**, not from the per-category intents that produced them. So a security
classified 60 % equity / 40 % fixed income moves both categories once, by the
amount actually applied to it.

The calculation is single-pass: the projection is not re-optimised after the
combination step, because iterating to correct the result is exactly the
construction V2 removed. A category can therefore end up outside its range even
though another was brought inside it. That is reported in the existing
outside-range strip and the **Current · Projected · Target** section, and it is
the user's cue to edit a line.

### 4.6 Limits applied before the worksheet is prefilled

In order:

1. **Funding.** Increases are funded by selected tracked cash, hypothetical
   external cash, and reduction proceeds (V2 cash model). If intents exceed
   available funding, every increase is scaled by the same factor; nothing is
   dropped selectively, since dropping would be a choice between securities.
2. **Held quantity.** A reduction cannot exceed the recorded position in the
   account it is drawn from.
3. **Rounding.** Under whole-unit policy, quantities are floored. Amounts stay
   primary and quantities remain estimates.
4. **Minimum line size.** Lines below the target's minimum are removed.
5. **Remaining cash.** Whatever is left after 3 and 4 is reported as remaining
   cash. It is not redistributed — redistribution is another round of
   construction.

---

## 5. Prefilling the worksheet

The V2 worksheet keeps its structure. The only change is where the first set of
values comes from.

- **Adjust positions** opens prefilled with the calculated adjustments instead
  of empty. Every line uses the same controls as a user-entered line: amount or
  Final %, same editor, same removal, same reset.
- The live portfolio-impact preview, the debounced authoritative core
  calculation, and the muted stale-result behaviour are unchanged.
- **Review adjustments** stays the validated account-level view and remains the
  only place copy and CSV can be produced.
- **Reset changes** returns to the calculated prefill, and clearing a line
  removes it entirely.
- Recalculating with different inputs replaces the prefill; user edits to lines
  the recalculation still produces are preserved where the security and account
  match, and the user is told when a line was replaced.

Copy that describes the worksheet as entirely user-entered has to change,
starting with `worksheet.reviewDisclaimer` ("These are the changes you
entered"). See §7.

---

## 6. Accounts

- **Reductions keep their source accounts.** A reduction is drawn from accounts
  that actually hold the security, which is a fact, not an assignment.
- **An increase is auto-assigned only when exactly one account is eligible.**
  Eligible means in scope and permitted to receive the security.
- **When several accounts are eligible, the app assigns nothing.** The line
  arrives with its amount unallocated and the existing progressive account
  allocation ("{{amount}} remaining") is how the user places it. No default, no
  tiebreak, no largest-position heuristic.
- **Funding is validated per account.** An increase in one account cannot be
  funded by cash recorded in another; no transfer between accounts is assumed or
  implied.
- Account type, tax wrapper and contribution room are never inputs.
  `crates/agent-tools/src/tools/contribution_limits.rs` must not be wired into
  this.

This is the stricter reading of decision 2, and it costs a single-account user
nothing.

---

## 7. Copy

Reuse the neutral vocabulary already on the worksheet branch: **Rebalancing
worksheet**, **Adjust positions**, **Review adjustments**, **Increase /
Reduce**, **Current · Projected · Target**, **Calculated change**.

| Use                                | Avoid                                     |
| ---------------------------------- | ----------------------------------------- |
| Calculated adjustments             | Proposed / suggested / generated trades   |
| Eligible securities                | Recommended securities                    |
| Allocation rule                    | Allocation strategy                       |
| Unresolved amount                  | Missing trade                             |
| Amounts primary, quantities second | Share counts as the headline figure       |
| (nothing)                          | Recommended, optimal, best, should, ideal |

Two copy changes the prefill forces:

- `worksheet.reviewDisclaimer` currently says the changes were entered by the
  user. Replace with the result copy agreed in review:

  > Wealthfolio calculated these adjustments from your target, eligible
  > securities, and allocation rule. Review and edit them before using the
  > result. Nothing is submitted or executed.

- Any hint text describing the worksheet as starting empty is updated in the
  same pass, across all locales, with the copy-contract test extended to catch
  regressions.

---

## 8. Export

Clipboard and CSV carry the same readable table, produced only from a fresh
**Review adjustments** result:

- Header: target, date, account scope, funding used, allocation rule, eligible
  securities count.
- One row per security/account allocation: category, direction, security,
  account, amount, estimated quantity, price and price date.
- Warnings, then the concise limitations disclosure that already travels with V2
  exports.
- Amounts are primary and signed; estimated quantities are secondary. No column
  reads like an order ticket.

---

## 9. Security-level targets — future work

Letting a user state "15 % VWCE" reduces what the app decides, since the rule in
§4.2 stops applying wherever the user has been explicit. The shape that fits the
model is per-category instrument weights nested under the category target, so
the strategic layer stays in asset classes and one number does not have to be
restated across every security.

Deferred on purpose: no schema, no migration, no API in this document. It needs
its own behaviour and UX agreement first, including how a partially specified
category resolves, whether ranges apply per security, and how the worksheet
prefill presents it.

---

## 10. Example weights

Already implemented on the worksheet branch and adopted here as-is: quantitative
titles generated from the weights, no risk or featured metadata, alphabetical
order, optional factual source and effective date, and the disclosure "Example
weights only. They are not recommendations, and Wealthfolio has not assessed
whether they fit you."

Saving the edited target is the user's affirmative action; no extra checkbox.
Internal preset IDs are unchanged since users never see them.

Remaining work is locale coverage and keeping the copy-contract test green.

---

## 11. Configuration persistence

Not required for the first release. The worksheet already keeps a device-local
draft of the editable inputs.

If the eligible-securities selection is later persisted, it is **saved
configuration** — the choices the user made — and not a promise that a stored
result can be reproduced. Results depend on prices, FX and recorded holdings at
calculation time and are recalculated on open, exactly as V2 specifies. The
likely home is `allocation_target_constraints` from #1177 with an asset-scoped
action rather than a new table.

---

## 12. Milestones

| #   | Content                                                     | Verify                                                                                                                            |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| M0  | Merge #1486 (eligible securities)                           | already green                                                                                                                     |
| M1  | Example weights + copy pass across locales (§7, §10)        | copy-contract test, i18n parity                                                                                                   |
| M2  | Allocation rule, combination and recalculation, limits (§4) | core tests: proportional split, multi-category combination, funding scale, held-quantity cap, rounding residue, unresolved amount |
| M3  | Worksheet prefill and account rules (§5, §6)                | prefill → edit → recalculate keeps user edits; increase with several eligible accounts stays unallocated                          |
| M4  | Export table and disclosure (§8)                            | export snapshot from a fresh review result                                                                                        |

M1 is independent and can ship first. M3 depends on M2.

---

## 13. Open questions

1. **Editing across recalculation (§5).** Preserving user edits when a
   recalculation still produces the same security/account line is the
   friendliest behaviour, but it makes "what am I looking at" harder to state.
   The alternative is a clean replace with a warning. Recommendation: preserve,
   and mark replaced lines.
2. **Funding shortfall (§4.6).** Scaling every increase by the same factor keeps
   the app out of choosing between securities, but it produces many small lines
   that the minimum line size may then remove. Acceptable, or should the
   shortfall simply be reported and the prefill left unfunded?
3. **Unresolved amounts in export (§4.4, §8).** Include them as rows with no
   security, or keep them in the app only?
4. **Minimum line size and rounding order.** Removing sub-minimum lines after
   rounding can leave a category short. Report only, or re-round?
   Recommendation: report only.
5. **Example weights source/date.** Which examples carry a factual source line,
   and where does that text come from?
6. **Existing targets.** Targets created from the old named presets keep their
   name. Migrate the label, or leave it as user-owned text?

---

## 14. References

- [Allocation Targets V2](https://github.com/wealthfolio/wealthfolio/blob/feature/allocation-worksheet-refactor/docs/features/allocations/v2-spec.md)
  — product boundary, worksheet, cash model, validation policy, disclosures. On
  `feature/allocation-worksheet-refactor`; switch to `./v2-spec.md` once merged.
- `feature/allocation-worksheet-refactor` — worksheet implementation, copy
  contract test, example weights.
- [`rebalance-algorithm.md`](./rebalance-algorithm.md) — V1 engine, retained for
  the arithmetic that survives.
- PR #1177 (constraints, turnover cap), PR #1486 (eligible securities).
