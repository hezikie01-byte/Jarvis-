import assert from 'node:assert/strict';

function legacyWorkerWrite(stateAtRead, newRemindedKeys) {
  // Mirrors the live worker's full-record replacement after reading a snapshot.
  return { ...stateAtRead, remindedKeys: newRemindedKeys, updatedAt: 'worker-time' };
}

function patchWorkerWrite(currentState, newRemindedKeys) {
  // Mirrors a field-only patch: user-owned fields are not rewritten.
  return { ...currentState, remindedKeys: newRemindedKeys, updatedAt: 'worker-time' };
}

function conditionalPatch(currentState, expectedUpdatedAt, newRemindedKeys) {
  if (currentState.updatedAt !== expectedUpdatedAt) {
    return { committed: false, state: currentState };
  }
  return { committed: true, state: patchWorkerWrite(currentState, newRemindedKeys) };
}

const original = {
  transactions: [{ id: 1, amount: 10 }],
  tasks: [],
  remindedKeys: [],
  updatedAt: 'v1'
};
const workerSnapshot = structuredClone(original);
const userSaved = {
  ...original,
  transactions: [{ id: 1, amount: 10 }, { id: 2, amount: 20 }],
  updatedAt: 'v2'
};

const legacyResult = legacyWorkerWrite(workerSnapshot, ['task:1']);
assert.equal(legacyResult.transactions.length, 1, 'legacy replacement should reproduce the lost update');

const patchResult = patchWorkerWrite(userSaved, ['task:1']);
assert.equal(patchResult.transactions.length, 2, 'field patch must preserve concurrent user transactions');

const casResult = conditionalPatch(userSaved, 'v1', ['task:1']);
assert.equal(casResult.committed, false, 'CAS must reject stale worker snapshot');
assert.equal(casResult.state.transactions.length, 2, 'CAS rejection must preserve user data');

// Demonstrate the send-before-persist duplicate window.
let deliveries = 0;
let persisted = false;
async function legacySendThenPersist({ failPersist }) {
  deliveries += 1;
  if (failPersist) throw new Error('simulated persistence failure');
  persisted = true;
}
await assert.rejects(() => legacySendThenPersist({ failPersist: true }));
await legacySendThenPersist({ failPersist: false });
assert.equal(deliveries, 2, 'send-before-persist can duplicate after a persistence failure');
assert.equal(persisted, true);

console.log(JSON.stringify({
  scenarios: [
    { name: 'legacy_full_record_write', result: 'reproduced_lost_user_update', transactionsAfterWorker: legacyResult.transactions.length },
    { name: 'field_only_patch', result: 'preserved_concurrent_user_update', transactionsAfterWorker: patchResult.transactions.length },
    { name: 'compare_and_swap', result: 'rejected_stale_worker_write', committed: casResult.committed },
    { name: 'send_before_persist', result: 'reproduced_duplicate_notification_window', deliveries }
  ],
  passed: 4,
  failed: 0,
  scope: 'deterministic in-memory simulation; not an AppDeploy integration test'
}, null, 2));
