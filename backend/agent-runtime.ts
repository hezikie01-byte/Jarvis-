import { secrets } from '@appdeploy/sdk';
import {
  resolveAgent, buildAgentContext, buildResponsesRequest,
  extractResponseText, sanitizeAgentResult, estimateCostUsd,
} from '../research/agents/runtime/agent-runtime.mjs';

const SUPABASE_URL = 'https://twfzosqjcupiwfuithmb.supabase.co';

async function supabaseRequest(key: string, path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> || {}) };
  if (!key.startsWith('sb_secret_')) headers.Authorization = 'Bearer ' + key;
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, { ...init, headers });
  const body = await response.text();
  if (!response.ok) throw new Error('supabase_' + response.status);
  return body ? JSON.parse(body) : null;
}

export async function runJarvisAgent(input: {
  task: string; domain: string; agentKey?: string; material?: string;
  state: Record<string, unknown>;
}) {
  const task = typeof input.task === 'string' ? input.task.trim().slice(0, 4000) : '';
  if (!task) throw new Error('task_required');
  const agent = resolveAgent({ agentKey: input.agentKey, domain: input.domain });
  const secretNames = await secrets.listSecretNames();
  if (!secretNames.includes('OPENAI_API_KEY') || !secretNames.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error('agent_secrets_not_configured');
  }
  const [openAiKey, supabaseKey] = await Promise.all([
    secrets.readSecret('OPENAI_API_KEY'),
    secrets.readSecret('SUPABASE_SERVICE_ROLE_KEY'),
  ]);

  const [configRows, promptRows] = await Promise.all([
    supabaseRequest(supabaseKey, 'jarvis_agent_registry?agent_key=eq.' + encodeURIComponent(agent.key) + '&select=*'),
    supabaseRequest(supabaseKey, 'jarvis_agent_prompt_versions?agent_key=eq.' + encodeURIComponent(agent.key) + '&status=eq.active&select=version,system_prompt&limit=1'),
  ]);
  const config = Array.isArray(configRows) ? configRows[0] : null;
  const prompt = Array.isArray(promptRows) ? promptRows[0] : null;
  if (!config || !config.enabled || !prompt?.system_prompt) throw new Error('agent_not_configured');
  if (config.model_id !== agent.modelId || config.reasoning_effort !== agent.reasoningEffort) throw new Error('model_registry_mismatch');

  const context = buildAgentContext(input.state || {}, input.domain, input.material || '');
  const fingerprintBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ task, context })));
  const fingerprint = Array.from(new Uint8Array(fingerprintBytes)).map(x => x.toString(16).padStart(2, '0')).join('');

  const runRows = await supabaseRequest(supabaseKey, 'jarvis_agent_runs', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      agent_key: agent.key, task_type: input.domain, status: 'running',
      input_fingerprint: fingerprint, input_summary: task.slice(0, 500),
      model_id: agent.modelId, prompt_version: prompt.version,
      approval_required: false, approval_state: 'not_required', started_at: new Date().toISOString(),
    }),
  });
  const runId = Array.isArray(runRows) ? runRows[0]?.id : null;
  if (!runId) throw new Error('agent_run_log_failed');

  try {
    const requestBody = buildResponsesRequest({
      modelId: agent.modelId, reasoningEffort: agent.reasoningEffort,
      systemPrompt: prompt.system_prompt, task, context,
      maxOutputTokens: Number(config.max_output_tokens) || 1800,
    });
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + openAiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) throw new Error('openai_' + response.status);
    const payload = await response.json();
    const usage = payload.usage || {};
    const result = sanitizeAgentResult(extractResponseText(payload));
    const cost = estimateCostUsd(agent.modelId, usage);

    await supabaseRequest(supabaseKey, 'jarvis_agent_runs?id=eq.' + encodeURIComponent(runId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'succeeded', output_summary: result.summary.slice(0, 1800),
        input_tokens: Number(usage.input_tokens) || 0, output_tokens: Number(usage.output_tokens) || 0,
        estimated_cost_usd: cost, finished_at: new Date().toISOString(),
      }),
    });

    let usageLogged = false;
    try {
      await supabaseRequest(supabaseKey, 'rpc/jarvis_agent_record_usage', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          p_usage_date: new Date().toISOString().slice(0, 10),
          p_agent_key: agent.key, p_model_id: agent.modelId,
          p_input_tokens: Number(usage.input_tokens) || 0,
          p_output_tokens: Number(usage.output_tokens) || 0,
          p_estimated_cost_usd: cost,
        }),
      });
      usageLogged = true;
    } catch {
      // Keep the successful model result; the run row still contains per-call usage.
    }

    if (result.proposed_actions.length) {
      await supabaseRequest(supabaseKey, 'jarvis_agent_decisions', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(result.proposed_actions.map(action => ({
          run_id: runId, agent_key: agent.key, decision_type: action.type || 'proposed_action',
          rationale: result.summary || 'Proposal only; not executed.',
          confidence: result.confidence, evidence: result.evidence, proposed_action: action,
          approval_required: true, approval_state: 'pending',
        }))),
      });
    }
    return {
      runId, agentKey: agent.key, modelId: agent.modelId, promptVersion: prompt.version,
      result, usage: { inputTokens: Number(usage.input_tokens) || 0, outputTokens: Number(usage.output_tokens) || 0 },
      estimatedCostUsd: cost, usageLogged,
    };
  } catch (cause) {
    await supabaseRequest(supabaseKey, 'jarvis_agent_runs?id=eq.' + encodeURIComponent(runId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'failed', error_code: cause instanceof Error ? cause.message.slice(0, 80) : 'unknown_error',
        finished_at: new Date().toISOString(),
      }),
    }).catch(() => null);
    throw cause;
  }
}
