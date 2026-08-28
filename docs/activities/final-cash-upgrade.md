# Upgrade notes: authoritative final cash (v3.7)

From this version, an activity's **amount** is the final cash that moved — fees
and taxes included. Readers book it as-is; nothing re-derives it at read time.
On first launch after upgrading, a one-shot migration rewrites legacy rows to
this contract. Make a normal database backup before updating. The application
does not create a potentially large automatic startup backup. What you may
notice:

## Some historical amounts were corrected or flagged

- A trade whose stored amount was the pre-fee **gross** now stores the final
  total (for example, a buy of `10 × $100` with a `$9.99` fee changes from
  `$1,000` to `$1,009.99`). The replaced value is recorded on the row's metadata
  (`final_cash_migration.legacy_amount`) — nothing is lost.
- A trade whose stored amount **contradicts** its own quantity × price ± charges
  keeps your number untouched and is flagged for review instead.
- Flagged rows appear in the review banner on the Activities page; open each one
  and confirm its asset, type, and final amount.

## Unverifiable activities require review

A trade priced in a different currency than the activity (for example, a
USD-quoted asset recorded in CAD) cannot be verified against quantity × price.
If it also has no stored amount, it books **no cash** until you supply the real
total — it sits in the review queue rather than silently booking a wrong-scale
number.

## Fees on plain cash entries no longer subtract

For deposits, withdrawals, and cash transfers, the amount **is** the ledger. A
separate fee column on such a row is informational and no longer reduces the
balance. If a $1,000 transfer actually moved $985, the truth is `amount = 985`.
Rows where this changes the historical balance were flagged for review rather
than rewritten.

## Contract multipliers

- The **asset** owns its contract multiplier. The multiplier field on the option
  form seeds a brand-new asset when it is first created; on an asset that
  already exists it has no effect, and cash, cost basis, and market value all
  follow the asset's value.
- A pre-existing row whose stored total was entered at a different scale than
  its asset says cannot be verified, so the upgrade keeps your number and flags
  the row for review. Correct the asset's multiplier and re-enter the total, or
  record the differently-scaled contract as its own asset.
- Bonds default to a multiplier of 1 (provider quotes are stored as a fraction
  of par). Percent-of-par pricing is opt-in per asset via `contractMultiplier`
  metadata.

## CSV import

Imported rows now pass the same writer policy as every other entry surface: a
missing trade total is derived, a gross total is converted to final, and a
contradicting total is kept but flagged. A row whose final cash cannot be
established is imported as a **draft** for review instead of silently booking
zero.
