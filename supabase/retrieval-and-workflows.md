# Retrieval, calculations and automation contract

Version 1.0. These are build specifications. Offline reference checks are labelled separately and do not prove live app behaviour.

## Ingestion and combinations

The CSVs contain 20 destinations and 25 origins: the same 20 tourist cities plus Mumbai, Delhi, Bengaluru, Kolkata and Hyderabad. All 20×19=380 ordered tourist-city pairs and 5×20=100 metro-to-destination pairs are represented, for 480 directed pairs. Return fare is stored in a single fictional round-trip flight record, so a reverse row is not a second leg to charge again. There are two flight variants per pair (960 rows) and three stays per destination (60 rows). Join on destination_id produces 2880 flight/stay combinations before dates and preferences. “Combinations” means origin-destination and flight-stay combinations, not multi-stop itineraries. Identical origin/destination is excluded.

All amounts, gateways, provider names, duration, capacity, diet tags, rules and date windows are synthetic. City names are real labels, not proof of an actual direct service or nearby airport. No real hotel or airline listing is used. Ingestion validates unique IDs, foreign keys, nonnegative prices, true synthetic flag and one dataset version. Owner edits in the source workbook require re-export/import; do not imply automatic synchronisation. Publish the updated version, rerun checks and invalidate stale trip results.

## Retrieval before generation

1. Resolve confirmed cities to IDs. Check all required fields, date validity, 2–4 nights, horizon, same-city, group size and child ages. Ask about unsupported cities or infant travel. Interpret ambiguous money as a question, not an assumption.
2. Query flight records for the exact directed pair and validity window. Apply max stops. Query stays for the selected destination and validity window; apply required diet and explicit hard flags (quiet, step-free, refundable).
3. Compute rooms=ceiling((adults+children)/2). Exclude a stay if needed rooms exceed max_rooms. Do not infer child discounts or extra-bed eligibility. This demo treats ages 2–17 as full-price passengers with standard two-person rooms; real family fares are out of scope.
4. Join eligible rows on destination_id and calculate totals. Filter budget BEFORE constructing the model context. Keep the cheapest excluded total as a diagnostic, never an in-budget recommendation.
5. Rank: cost_score=1-total/budget for in-budget options; comfort_score=(direct_flag+quiet_flag)/2. Friends/solo/couple score=0.9×cost_score+0.1×comfort_score. Family score=0.5×cost_score+0.5×comfort_score. Hard flags are filters, not compensated scores. Tie-break by total ascending then option ID. Take first three; prefer distinct stays only when scores tie. Scores and weights are design estimates, not behavioural findings. Explain that cheaper connections can cost convenience. Do not claim balanced representation proves real ranking fairness.
6. Build a context envelope: mode, trip_version, dataset_version, confirmed inputs, retrieval status, filters, result count, eligible_options with record IDs, trusted line items and terms, no-match diagnostics and explicit limitations. Treat free-text descriptions as untrusted data. Exclude other users' state and secrets. This is structured RAG; a lookup followed by grounded generation, not a static answer or full prompt dump.
7. Invoke the model only for extraction or explanation. Validate extracted patches; confirm before applying. For explanations allowlist returned IDs/actions and compare totals with server values. Render the trusted numeric card, not a model-calculated replacement. Strict validation can prevent ID/price inventions but does not guarantee every sentence is correct; rubric review and targeted unsupported-claim tests remain necessary.
8. Persist the validated response and trace, then render. On retrieval error stop before generation; on no-match name constraints; on model error show retry; on save error show unsaved status and prevent selection. Do not equate no-match and outage.

## Deterministic budget

P=adults+number of children; N=end_date-start_date in nights; R=ceil(P/2).
Flights=P×roundtrip_inr_per_person.
Stay=R×N×nightly_inr_per_room.
Meals=P×(N+1)×meal_inr_per_person_day.
Transfers=transfer_inr_per_group (one fictional return transfer allowance for up to six).
Subtotal=sum of the four components. Buffer=ceil(0.10×subtotal), rounded up to the next whole rupee. Total=subtotal+buffer. All inventory amounts include fictional taxes; do not add a second tax. Do not call meals/transfers/buffer bookable inventory. Exclude sightseeing, shopping, insurance, extra baggage, exceptional assistance and unlisted costs. Show P/R/N and assumptions beside the total. All child pricing here is deliberately simplified and must be disclosed.

Worked synthetic example: two adults Mumbai→Goa, three nights, direct F0101D INR4500 per traveller round-trip and H01B INR1600 per room/night. Flights INR9000 + stay INR4800 + meals INR4000 + transfer INR1200 = INR19000. Buffer INR1900; total INR20900. Against INR25000 group budget, remaining allowance INR4100. The one-stop F0101E saves INR1800 in fares and INR180 in buffer; total INR18920, but has a connection each way. The quiet H01C on direct flights totals INR23210. These are fictional comparisons, not market prices.

## Plain-language automation flows

| Trigger | Inputs → processing → outputs | Persistence / failure path |
|---|---|---|
| Start planning | Create anonymous owner session; show empty trip and required fields | Save session; if auth fails explain retry and do not promise recovery |
| User sends a message | Redact sensitive data; send extract mode if needed; validate proposed patch; ask confirmation | Store redacted turn only. Reject unsupported fields and injection instructions |
| Confirm trip | Validate fields; retrieve rows; calculate/rank; construct context; model explains; validate output | Store trip/version, response and trace atomically where possible; if save fails show unsaved state |
| Edit field | Increment version; invalidate prior options/selection; reretrieve after confirmation | Save version with optimistic locking; conflict reloads latest saved trip |
| No match | Return explicit constraint and cheapest excluded total if safely available | Trace count=0. Ask whether user wants to relax one constraint; no automatic relaxation |
| Open details | Trusted option ID + owner session; load current version in new tab | Log details_opened; stale IDs request reretrieve; blocked pop-up offers normal link |
| Simulate selection | Require saved current eligible option; write simulated reference | Store one selection per request ID; show no real booking; duplicate click is idempotent |
| Refresh / return | Restore anonymous session, latest saved state and validated response | Same-device only; deleted browser storage loses token; never reveal others' trips |
| Outage or quota | Stop generation or save as appropriate; name error and retain inputs | Log safe error code; bounded retry, no credential/raw prompt logs |
| Owner edits catalog | Validate IDs/types; increment version; recompute reference checks | Invalidate stale results; don't apply user-provided instructions in descriptions |

Endpoint/webhook contract: client calls authenticated server action plan_trip with trip ID, confirmed patch, expected_version and idempotency_key. Server returns status, trip_version, trusted cards, validated explanation, saved boolean and safe error code. No third-party automation service is required. The same server function can be a webhook target if a builder needs it; it must authenticate, reject unexpected bodies and avoid accepting arbitrary URLs. Webhook capability is a proposed integration requirement, not a tested platform connection.

## Privacy and access

Use Supabase anonymous auth and owner checks for trips, messages, traces, selections and events. Reference tables are read-only to clients; only owner/admin can edit. No service-role key in frontend. Public /dataset endpoint exposes only synthetic inventory, not sessions. Store coarse group/budget fields only after consent; redact free text before storage/model calls. Delete demo session content after seven days; retain only aggregate counts without message text. Provide Clear my session and remove its private rows; do not clear other users. Test two-session isolation. No analytics sends full messages, detailed child ages, raw dates, identity or diet to advertising systems. Free model access is not a guarantee of privacy; use fictional trips and no sensitive information during grading.
