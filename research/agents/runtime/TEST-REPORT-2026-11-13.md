# Agent Runtime Tests — 2026-11-13 (revised)

## Current result
**13 passed, 0 failed** in an isolated Node.js v22.16.0 test harness for the updated runtime logic.

Coverage:
- Seven declared agent profiles and specialist model assignments.
- Deterministic domain routing and rejection of unsupported or mismatched roles.
- Synthetic transaction exclusion and undated cash-flow exclusion.
- Bounded deal history.
- Explicit Responses API model, output cap, and `store: false`.
- Rejection of unknown/unapproved models.
- Responses API output extraction.
- Proposed actions forced to `not_executed` and `approval_required`.
- Safe plain-text fallback.
- Model-specific cost estimation.
- Missing financial values remain null (not fabricated as zero); missing currency remains unknown (not defaulted to ILS).
- Specialist-specific output fields survive normalization.

## Important limits
- This is a local isolated harness, not a GitHub Actions run against the checked-out branch.
- No live OpenAI model request was sent. The secure OpenAI and Supabase secret entries remain pending.
- No Dropbox gateway or live Dropbox data test has been completed.
- The manager/orchestrator profile is disabled until dispatch, evidence merging, and approval gates are implemented and tested.
- No AppDeploy route integration or production deployment has occurred.
