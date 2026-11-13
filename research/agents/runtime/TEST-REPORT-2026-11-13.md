# Agent Runtime Simulation Report — 2026-11-13 (expanded)

## Result
**21 passed / 0 failed**

The updated runtime and test suite were executed in an isolated Node.js v22.16.0 environment. The test source was taken from the research branch; the run did not call any live AI API and did not modify the live AppDeploy application.

## Simulated inputs
- A real Dropbox engineering audit document from the J.A.R.V.I.S. project folder, containing static findings about reminder-worker concurrency, duplicate notifications, swallowed worker errors, and backend schema validation.
- Synthetic, non-personal transaction/deal/task fixtures for edge cases.
- Adversarial text embedded inside source material to verify it is treated as untrusted input.

## Coverage
1. Seven agent profiles and model-tier configuration.
2. Deterministic routing; rejection of manager direct calls and domain mismatches.
3. Exclusion of synthetic/demo transactions.
4. Cash-flow analysis requires dated records.
5. Deal-history bounds and preservation of unknown amounts/currencies.
6. Responses request model allowlist, output-token cap, and `store: false`.
7. Rejection of unapproved models and missing prompts.
8. Responses API output extraction.
9. Proposed actions forced to `not_executed` and `approval_required`.
10. Plain-text fallback without fabricated structure.
11. Model-specific cost estimation.
12. Preservation of specialist-specific result fields.
13. Real Dropbox engineering audit accepted as bounded source material for code review.
14. Adversarial instructions in source material are explicitly marked untrusted.
15. Operations context record-count limits.
16. Missing financial amounts remain null.
17. Research source text capped at 12,000 characters.
18. Long summaries and excessive action lists are capped.
19. Source audit issue markers are recognized for QA triage.
20. Nested model outputs bounded by depth, width and string length.
21. Audit stats and operations context nested payloads are bounded.

## Findings and next blockers
- Output normalization previously preserved specialist-specific fields without bounding nested payloads. This is now bounded to depth 4, 30 entries/items per level and 1,200 characters per string.
- Audit stats and operations events/tasks now receive the same nested bounds.
- The real Dropbox document was used as test input only; no Dropbox files were changed.
- The manager remains disabled until real dispatch and evidence-merging behavior is implemented.
- OpenAI and Supabase secret-entry forms remain pending. No live model calls were made.
- Dropbox gateway is not yet implemented; this simulation passed one real document through the runtime's bounded source-material path.
- No AppDeploy route integration, finance-data migration, or production deployment occurred.

## Interpretation
These results validate deterministic runtime behavior and input/output boundaries. They do not establish the quality of live model reasoning, agent-to-agent collaboration, API latency, or production reliability. Those require secure API credentials and an owner-approved read-only data source.
