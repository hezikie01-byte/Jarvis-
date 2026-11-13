# Supabase Agent Runtime — Applied Database Changes

Project: \`Jarvis\` (\`twfzosqjcupiwfuithmb\`), region \`ap-southeast-2\`.

## Applied migrations
- \`20261113191532 jarvis_agent_runtime_foundation_v1\`
- \`20261113191610 jarvis_agent_read_context_rpc_v1\`
- \`20261113191640 jarvis_agent_prompts_and_owner_guard_v1\`
- \`202611131917xx jarvis_agent_usage_atomic_rpc_v1\` (exact version is recorded in Supabase migration history)

## Runtime tables
- \`jarvis_agent_registry\`: seven configured roles, explicit model IDs, token caps, tool allowlists and denied actions.
- \`jarvis_agent_prompt_versions\`: versioned system prompts; v1 active for all seven roles.
- \`jarvis_agent_runs\`: task status, model, prompt version, token usage, cost estimate and outcome.
- \`jarvis_agent_decisions\`: evidence-backed proposals with approval state.
- \`jarvis_agent_memory\`: scoped, expiring memory records.
- \`jarvis_agent_usage_daily\`: per-agent/model usage counters.

## Database security
- All six agent tables have RLS enabled.
- No policies are granted to \`anon\` or \`authenticated\`.
- Table privileges are revoked from \`PUBLIC\`, \`anon\`, and \`authenticated\`; service role only.
- \`jarvis_agent_read_context(uuid,text)\` and \`jarvis_agent_is_owner(uuid)\` are executable by \`service_role\` only.
- \`jarvis_agent_record_usage(...)\` performs atomic daily usage increments and is executable by \`service_role\` only.
- Manual verification confirmed: anonymous execution false, authenticated execution false, service-role execution true.
- The read-context RPC was exercised against a synthetic, non-existent UUID and returned empty account/deal/snapshot arrays without touching user records.

## Current limitations
- No Supabase Auth owner has been provisioned or linked yet.
- The canonical finance tables are empty. Existing AppDeploy/local-first data has not been migrated.
- No agent Edge Function is deployed.
- The agent backend adapter is in the research branch and awaits secure credentials plus route integration.
- No live model call has been made; no production app code has been changed.
