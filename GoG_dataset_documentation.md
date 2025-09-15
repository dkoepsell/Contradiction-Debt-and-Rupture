
## Ground-Truth Labels: `rupture_occurred`

To enable replication of predictive accuracy metrics (e.g., AUROC, Brier scores), we added a binary column `rupture_occurred`.

### Coding Rule
- `rupture_occurred = 1` if the country–year profile corresponds to a documented rupture event (breakdown of legitimacy/authority within two quarters, such as government collapse, coup, revolution, or mass atrocity).
- `rupture_occurred = 0` otherwise.

### Step A (cross-section only)
The 2023-only dataset initially had no retrospective rupture years. All rows were coded `rupture_occurred = 0`.

### Step B (extended with retrospective cases)
We appended rows for the following historical ruptures, each marked with `rupture_occurred = 1`:
- Tunisia (2011) — mass protests and fall of Ben Ali (Jasmine Revolution).
- Lebanon (2019) — October 17 protest wave and collapse of government.
- Myanmar (2021) — February 1 military coup and ensuing crackdown.
- Sri Lanka (2022) — economic collapse, mass protests, resignation of government.
- Nepal (2025) — Generation Z protests, burning of parliament, resignation of PM.

All other country–year rows are coded `0`. These labels follow the coding manual provided in Appendix C and allow transparent replication of validation metrics.

### Note
Predictor variables (`V_total`, `R`, `capacity_factor`, etc.) for appended retrospective rows are currently set to NA because the 2023 cross-section dataset does not include those years. Reviewers may cross-reference the coding manual and appendix tables to reconstruct these values if desired.
