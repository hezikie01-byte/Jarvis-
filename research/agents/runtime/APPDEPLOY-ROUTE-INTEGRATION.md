# AppDeploy route integration

The helper in \`backend/agent-runtime.ts\` is designed to be wired into the existing AppDeploy backend without changing the current finance state format.

## Required imports

Add beside the existing SDK imports:

\`\`\`ts
import { secrets } from '@appdeploy/sdk';
import { runJarvisAgent } from './agent-runtime';
\`\`\`

## Owner-only routes

Add these routes to the existing \`router({...})\` map:

\`\`\`ts
'GET /api/agents/status': [requireAuth(), ownerOnly, async () => {
  const names = await secrets.listSecretNames();
  return json({
    configured: names.includes('OPENAI_API_KEY') && names.includes('SUPABASE_SERVICE_ROLE_KEY'),
    agentRuntime: 'v1',
    deployment: 'not_deployed_by_research_branch'
  });
}],
'POST /api/agents/run': [requireAuth(), ownerOnly, async ({ user, body }) => {
  const input = body as { task?: string; domain?: string; agentKey?: string; material?: string };
  if (!input?.task?.trim() || input.task.length > 4000) return error('A task of 1-4000 characters is required', 400);
  if (!input.domain || !['financial_audit','deal_analysis','cashflow','research','code_review','operations'].includes(input.domain)) {
    return error('Unsupported agent domain', 400);
  }
  if (user?.userId !== OWNER_USER_ID) return error('Owner access required', 403);
  const current = await getState(OWNER_USER_ID);
  try {
    const result = await runJarvisAgent({
      task: input.task,
      domain: input.domain,
      agentKey: input.agentKey,
      material: input.material,
      state: (current.record || {}) as Record<string, unknown>
    });
    return json(result);
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : 'agent_runtime_failed';
    if (code === 'agent_secrets_not_configured') return error('Agent credentials are not configured', 503);
    if (code === 'agent_run_log_failed') return error('Could not create an auditable agent run', 503);
    return error('Agent run failed: ' + code.slice(0, 80), 502);
  }
}],
\`\`\`

The route is intentionally not applied to the running AppDeploy source yet. It must be integrated, reviewed, tested with synthetic fixtures, then deployed only after a separate release approval.

## Identity bridge
The current live app authenticates through AppDeploy and stores local-first state under the existing owner ID. The new Supabase finance schema references Supabase Auth UUIDs. Do not cast or invent an ID to bridge these systems. This first adapter uses the already owner-gated AppDeploy state and stores run logs in Supabase with \`requested_by = null\`. The future migration must provision the single Supabase Auth owner and explicitly link the identities before using the Supabase finance context RPC.
