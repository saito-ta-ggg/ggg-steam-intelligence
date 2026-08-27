# Open Questions

1. Production authentication/SSO.
2. Final Cloud Run project/service/domain.
3. Canonical source for release dates, languages, images and store metadata.
4. Canonical sale/event dataset and naming.
5. Reviews ingestion completion and final table names.
6. Wishlist ingestion scope/cadence.
7. External bundle/event normalization (e.g. Fanatical).
8. Competitor/public-title mode placement in Phase 2.
9. Whether financial metrics require role-based visibility.

## Raised during Phase 1 implementation

10. **Monetary rule for an arbitrary multi-day range.** `METRICS.md` gives a
    fine-grain rule (raw sums) and a calendar-month rule (TRUNC per
    package-month), but not a rule for a range such as "last 90 days" or a whole
    quarter. Phase 1 follows the documented text literally: KPI cards and any
    non-month grain use the fine-grain rule, and the calendar-month rule is used
    only for month rows. Every surface states which rule produced it. Confirm
    whether a range that happens to span whole months should instead be composed
    from calendar-month results.
11. **Fiscal-year monetary aggregation.** `METRICS.md` defines a truncation
    intermediate grain for the calendar month but not for the fiscal year. FY
    rows are currently the sum of their calendar-month values. Confirm whether an
    FY-level intermediate grain (e.g. FY x packageid) is required instead, which
    would change the cents.
12. **Comparable-period definition.** `UI_SPEC.md` asks for a comparable-period
    delta but does not define the comparison window. Phase 1 uses the range of
    equal length ending the day before the selected range begins. Confirm whether
    the business expects year-on-year, previous calendar month, or this.
13. **Current base package for RPG Maker MV.** `METRICS.md` names the current
    package for MZ (`488238`) but not for MV. Left undefined rather than guessed.
14. **Return Rate basis.** `METRICS.md` defines Return Rate on units only. Confirm
    whether a value-based return rate (returns USD over gross USD) is also wanted;
    it is not implemented.
15. **Country-level Revenue Share.** Country is a fine-grain grain, so the
    Countries tab sums row-level `revenue_share_usd`. That figure will not
    reconcile exactly with the calendar-month Revenue Share on the Sales tab.
    Confirm this is acceptable, or specify how Revenue Share should be attributed
    to a country under the calendar-month rule.
16. **Community Market Game Fee.** Absent from the warehouse and therefore absent
    from Revenue Share. Confirm whether Phase 2 must source it, since its absence
    makes internal NET incomplete for titles that have Market activity.
17. **Multi-currency price observations.** `base_price`/`sale_price` are local
    minor units, so a single day carries several prices. **Resolved for Phase 1:**
    the price observation is pinned to a single reference market, **US / USD**;
    within that market the observation backed by the most gross units sets the
    day's price, and a day with no US/USD row reports `No data` rather than
    borrowing another market's currency. Unit and USD money columns are not
    restricted by this and continue to cover the whole selected scope. The market
    is stated in the UI wherever a price or observed discount appears. Confirm
    whether US/USD is the right reference market for the business, and whether a
    per-market pricing view is needed in a later phase.
18. **Retail activation scope.** Retail rows are excluded from every financial
    figure and surfaced only as activation counts. Confirm which team owns the
    Retail view and whether it needs its own tab in a later phase.
