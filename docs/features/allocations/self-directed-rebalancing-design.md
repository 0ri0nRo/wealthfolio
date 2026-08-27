# Self-Directed Rebalancing — Design Document

Status: Source of truth for allocation rebalancing, no open questions Date:
2026-08-27 Authors: @Jonjon-prog Reviewers: @afadil, @marcoscale98

Context: [PR #1486](https://github.com/wealthfolio/wealthfolio/pull/1486)
discussion.

`docs/features/allocations/v2-spec.md`, which lives on
`feature/allocation-worksheet-refactor`, is obsolete: it describes the earlier
manual-only direction and is superseded by this document. That branch stays
unchanged as a UX and code reference to copy from. Implementation starts from a
fresh branch off `main` and reuses the worksheet UI, account allocation, copy,
exports and example-weight work from it.

---

## 1. Why this document

The manual-only direction removed the optimizer and replaced it with a worksheet
that starts empty and is authored line by line. That protects the product, but
it also removes the part of the feature people actually used: not having to work
out the amounts by hand.

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

The product boundary stands: Wealthfolio does not select, rank, optimize,
recommend, or execute investments.

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
- Reuse the worksheet from the reference branch as-is: position editor,
  progressive account allocation, live portfolio impact, **Review adjustments**,
  export.
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
construction the manual-only direction removed. A category can therefore end up
outside its range even though another was brought inside it. That is reported in
the existing outside-range strip and the **Current · Projected · Target**
section, and it is the user's cue to edit a line.

### 4.6 Limits applied before the worksheet is prefilled

In order:

1. **Funding.** Increases are funded by selected tracked cash, hypothetical
   external cash, and reduction proceeds (cash model from the reference branch).
   If intents exceed available funding, every increase is scaled by the same
   factor; nothing is dropped selectively, since dropping would be a choice
   between securities. The scaling is stated in the result and travels with the
   export, so a scaled figure is never mistaken for the full amount.
2. **Held quantity.** A reduction cannot exceed the recorded position in the
   account it is drawn from.
3. **Rounding.** Under whole-unit policy, quantities are floored. Amounts stay
   primary and quantities remain estimates.
4. **Minimum line size.** Lines below the target's minimum are reported as below
   minimum rather than silently dropped. Nothing is re-rounded to lift them over
   the threshold; the user removes or edits them.
5. **Remaining cash.** Whatever is left after 3 and 4 is reported as remaining
   cash. It is not redistributed — redistribution is another round of
   construction.

---

## 5. Prefilling the worksheet

The worksheet keeps its structure. The only change is where the first set of
values comes from.

- **Adjust positions** opens prefilled with the calculated adjustments instead
  of empty. Every line uses the same controls as a user-entered line: amount or
  Final %, same editor, same removal.
- **Once prefilled, the worksheet is the source of truth.** Editing a line
  updates the live portfolio-impact preview and nothing else. The debounced core
  calculation still runs to validate the edited worksheet and produce that
  preview; it does not re-derive the adjustments.
- **Adjustments are regenerated only on an explicit user action**, of which
  there are exactly two: **Recalculate from target**, which rebuilds them from
  the current target, eligible securities and allocation rule, and **Reset to
  calculated adjustments**, which restores the last generated set and discards
  edits.
- Changing an input the calculation depends on — cash to deploy, account scope,
  eligible securities, the target itself — marks the worksheet as no longer
  matching those inputs and offers **Recalculate from target**. It never
  regenerates on its own, so an edited worksheet is never overwritten without
  the user asking.
- **Review adjustments** stays the validated account-level view and remains the
  only place copy and CSV can be produced.

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

Two actions are new and carry the regeneration rule from §5: **Recalculate from
target** and **Reset to calculated adjustments**. They replace the branch's
single **Reset changes**, which no longer describes what happens.

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
  securities count, and whether increases were scaled (§4.6).
- One row per security/account allocation: status, category, direction,
  security, account, amount, estimated quantity, price and price date.
- **Unresolved amounts (§4.4) are rows in the same table**, with
  `Status: Unresolved`, their category and amount filled in, and security,
  account and quantity left empty. They are part of the picture, so they belong
  in the file rather than only on screen.
- Warnings, then the concise limitations disclosure that already travels with
  the reference branch exports.
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

Taken from the worksheet branch: quantitative titles generated from the weights,
no risk or featured metadata, alphabetical order, and the disclosure "Example
weights only. They are not recommendations, and Wealthfolio has not assessed
whether they fit you."

Two changes against that branch:

- **No source or effective-date metadata.** The `sourceLabel` and
  `effectiveDate` fields and the `presets.sourceLine` copy are dropped. Examples
  stay purely quantitative.
- **No claim that an example reproduces anything external.** No wording that
  ties a set of weights to a current index, a market allocation or a published
  portfolio, since keeping such a claim true over time is a commitment we cannot
  meet.

Existing target names are left alone. The quantitative naming applies only to
examples selected from now on, so nothing a user already saved is rewritten
underneath them.

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
calculation time and are recalculated on open, as the worksheet already does.
The likely home is `allocation_target_constraints` from #1177 with an
asset-scoped action rather than a new table.

---

## 12. Milestones

Three shipments.

| #      | Content                                                                                                            | Verify                                                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0     | ✅ Done. #1486 (eligible securities) rebased and merged on 2026-08-27                                              | merged as `a0dcadeb5`, with symbol disambiguation added in `50515d41f`                                                                                                                                                                                                                                                                             |
| M1     | The complete calculated worksheet: copy, calculation, prefill, account allocation, preview, export (§4 to §8, §10) | core tests for proportional split, multi-category combination, funding scale, held-quantity cap, rounding residue and unresolved amounts; edits never trigger regeneration and both explicit actions do; increase with several eligible accounts stays unallocated; copy-contract test and i18n parity; export snapshot from a fresh review result |
| Future | Optional security-level targets (§9)                                                                               | after the main workflow is stable                                                                                                                                                                                                                                                                                                                  |

Implementation branches from the latest `main` and copies the worksheet UI,
account allocation, copy, exports and example-weight work from
`feature/allocation-worksheet-refactor`. That branch is a reference, not a base:
it is not rebased, extended or merged.

---

## 13. Settled questions

Nothing is open. The decisions taken during review, with the section that
carries each one:

| Question                             | Decision                                                                            | Section |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ------- |
| Iterate after combining intents?     | No. Single pass, show the projection, let the user edit                             | §4.5    |
| Funding shortfall                    | Scale every increase proportionally and state that the scaling was applied          | §4.6    |
| Sub-minimum lines and remaining cash | Report both. No re-rounding, no redistribution                                      | §4.6    |
| Editing after prefill                | The worksheet becomes the source of truth; editing only updates the preview         | §5      |
| Regenerating adjustments             | Only on **Recalculate from target** or **Reset to calculated adjustments**          | §5      |
| Account attribution                  | Auto-assign only when exactly one account is eligible, otherwise the user allocates | §6      |
| Unresolved amounts in the export     | Same table, `Status: Unresolved`, category and amount only                          | §8      |
| Example weights metadata             | No source or effective date, no external-index claim                                | §10     |
| Existing target names                | Left unchanged; quantitative naming applies to new selections only                  | §10     |
| Configuration persistence            | Saved configuration, not result reproduction, and out of the first release          | §11     |

---

## 14. References

- [Allocation Targets V2](https://github.com/wealthfolio/wealthfolio/blob/feature/allocation-worksheet-refactor/docs/features/allocations/v2-spec.md)
  — obsolete. Describes the manual-only direction and is superseded by this
  document. Still useful for its cash model, validation policy and disclosure
  wording, which this design keeps.
- `feature/allocation-worksheet-refactor` — worksheet implementation, copy
  contract test, example weights.
- [`rebalance-algorithm.md`](./rebalance-algorithm.md) — V1 engine, retained for
  the arithmetic that survives.
- PR #1177 (constraints, turnover cap), PR #1486 (eligible securities).
