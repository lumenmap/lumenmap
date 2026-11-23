# Soroban invoke success

For a contract and a period, Hubble may expose how many invokes succeeded and how many failed. The detail panel shows both counts and the success share in text. Color is not the only carrier.

If either column is missing, null, or not a non-negative integer, the panel says the rate is unavailable. It does not treat a missing column as zero, and it does not throw. A contract with no invokes in the period is also unavailable rather than 0%.

Per-error-code breakdowns and simulation retries are out of scope. The rate is successful invokes divided by successful plus failed invokes.
