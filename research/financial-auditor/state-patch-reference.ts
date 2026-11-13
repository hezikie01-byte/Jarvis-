/**
 * Reference implementation only — NOT wired into the deployed backend.
 * Demonstrates AppDeploy's documented db.tx.update(..., { patch: true }) API.
 */
import { db } from '@appdeploy/sdk';

type StateInput = {
  transactions: unknown[];
  events: unknown[];
  tasks: unknown[];
  goals: unknown[];
  settings: Record<string, unknown>;
  investmentDeals?: Array<Record<string, unknown>>;
};

export async function patchExistingUserState(
  physicalRecordId: string,
  input: StateInput
): Promise<void> {
  const patch: Record<string, unknown> = {
    transactions: input.transactions,
    events: input.events,
    tasks: input.tasks,
    goals: input.goals,
    settings: input.settings,
    updatedAt: new Date().toISOString()
  };
  // Omission preserves the stored value; do not write undefined or null here.
  if (input.investmentDeals !== undefined) patch.investmentDeals = input.investmentDeals;

  const [updated] = await db.tx.update('user_state', [{
    id: physicalRecordId,
    record: patch
  }], { patch: true });

  if (!updated) {
    // The target disappeared or the operation did not apply.
    // Caller must re-read and reconcile; never fall back to db.update replacement.
    throw new Error('user_state_patch_not_applied');
  }
}

export async function patchReminderKeys(
  physicalRecordId: string,
  remindedKeys: string[]
): Promise<void> {
  const [updated] = await db.tx.update('user_state', [{
    id: physicalRecordId,
    record: {
      remindedKeys: [...remindedKeys],
      updatedAt: new Date().toISOString()
    }
  }], { patch: true });

  if (!updated) throw new Error('reminder_state_patch_not_applied');
}
