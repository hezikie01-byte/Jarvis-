# J.A.R.V.I.S. Agent Runtime v1

## Real system boundary
- Supabase stores seven agent profiles, active prompt versions, run logs, proposed decisions, scoped memory metadata, and daily usage.
- Existing live app state remains AppDeploy/local-first. The initial adapter reads that state through the existing owner-only backend; it does not silently migrate or overwrite it.
- Supabase finance tables remain the planned canonical store after the single Supabase Auth owner identity is provisioned and linked.
- OpenAI and Supabase server credentials are held only in AppDeploy encrypted secrets.

## Model assignment
| Role | Model | Work |
|---|---|---|
| Manager | gpt-6.1-sol | deterministic routing now; cross-agent synthesis later |
| Financial Data Auditor | gpt-6.1-sol | reconciliation and anomaly review |
| Deal Performance Analyst | gpt-6.1-sol (high reasoning) | deal metrics and repayment analysis |
| Cash-flow Forecaster | gpt-6-luna | bounded forecast explanations |
| Research & Opportunity Scout | gpt-6.1-sol | sourced research |
| Product & Code Guardian | gpt-6.1-sol | code, security and QA review |
| Personal Operations Assistant | gpt-6-luna | reminders, calendar and tasks |

GPT-6.1 Terra is reserved for future visual intake. GPT-6 Astra is an escalation model, not a default call. The manager profile is disabled until deterministic dispatch, evidence merging, and approval gates are implemented and tested.

## Runtime rules
1. Authenticate the owner and use a fixed agent/domain allowlist.
2. Load model and active prompt configuration from Supabase.
3. Build bounded domain-specific context. Exclude synthetic transactions from real financial analysis.
4. Call the OpenAI Responses API with explicit model, reasoning effort and token cap; set \`store: false\`.
5. Log token usage, estimated cost, result summary and decisions without persisting full raw financial context.
6. Proposed actions are always unexecuted and require owner approval.
7. No financial write tools, transfers, trades, deletes or production deploys are available to agents in v1.

## Model cost baseline
- GPT-6.1 Sol: $2 / 1M input tokens; $10 / 1M output tokens.
- GPT-6 Luna: $0.10 / 1M input tokens; $0.50 / 1M output tokens.
- GPT-6.1 Terra (future image intake): $1 / 1M input tokens; $5 / 1M output tokens.
- API usage is billed separately from a ChatGPT subscription. Usage is recorded per run and aggregated daily.

## Data handling
- API inputs/outputs are not used for model training by default.
- Responses requests set \`store: false\` to disable default response application-state storage. This does not automatically grant Zero Data Retention: default abuse-monitoring logs may still retain content for up to 30 days.
- The Supabase project currently resides in Australia (ap-southeast-2). No personal finance data has been migrated there yet; confirm data-location preference before migration.

## Activation
- [ ] Complete the encrypted OpenAI API key setup.
- [ ] Store OPENAI_API_KEY and SUPABASE_SERVICE_ROLE_KEY in the secure-entry form.
- [ ] Bind the entries to AppDeploy app app-hh6wc6.
- [ ] Integrate the owner-only /api/agents/run route into the current backend.
- [ ] Test with synthetic fixtures, then run read-only against the current app state.
- [ ] Link the Supabase Auth owner identity before migrating canonical finance records.
