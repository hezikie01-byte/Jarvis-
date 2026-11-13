/**
 * J.A.R.V.I.S. read-only financial data auditor prototype.
 *
 * This module reports evidence-backed anomalies only. It never mutates input,
 * repairs records, or infers missing financial values.
 */

const VALID_CLASSIFICATIONS = new Set(['principal', 'interest', 'mixed', 'unknown']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function finding(code, severity, dealId, message, evidence = {}) {
  return { code, severity, dealId, message, evidence };
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function duplicateKey(payment) {
  return JSON.stringify([
    payment.date ?? null,
    payment.amount,
    payment.classification ?? 'unknown',
    payment.principalAmount ?? null,
    payment.interestAmount ?? null,
    payment.note ?? null
  ]);
}

/**
 * @param {unknown} input
 * @returns {{status: 'completed'|'invalid_input', findings: object[], summary: object}}
 */
export function auditInvestmentDeals(input) {
  if (!Array.isArray(input)) {
    return {
      status: 'invalid_input',
      findings: [finding('INVALID_COLLECTION', 'critical', null,
        'רשימת העסקאות אינה מערך תקין.')],
      summary: { dealsChecked: 0, paymentsChecked: 0, findings: 1 }
    };
  }

  const findings = [];
  let paymentsChecked = 0;
  const seenDealIds = new Set();

  input.forEach((deal, dealIndex) => {
    const dealId = deal && typeof deal.id === 'string' ? deal.id : null;
    if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
      findings.push(finding('INVALID_DEAL_RECORD', 'critical', dealId,
        'רשומת עסקה אינה אובייקט תקין.', { dealIndex }));
      return;
    }

    if (!dealId) {
      findings.push(finding('MISSING_DEAL_ID', 'high', null,
        'לעסקה חסר מזהה יציב.', { dealIndex }));
    } else if (seenDealIds.has(dealId)) {
      findings.push(finding('DUPLICATE_DEAL_ID', 'critical', dealId,
        'נמצא יותר מרישום עסקה אחד עם אותו מזהה.'));
    } else {
      seenDealIds.add(dealId);
    }

    for (const field of ['principal', 'payment']) {
      if (!Number.isFinite(deal[field]) || deal[field] < 0) {
        findings.push(finding('INVALID_DEAL_AMOUNT', 'high', dealId,
          'סכום העסקה חסר או אינו תקין.', { field, value: deal[field] ?? null }));
      }
    }

    if (!Array.isArray(deal.history)) {
      findings.push(finding('INVALID_PAYMENT_HISTORY', 'critical', dealId,
        'היסטוריית התקבולים אינה מערך תקין.'));
      return;
    }

    if (Number.isFinite(deal.received) && deal.received !== deal.history.length) {
      findings.push(finding('RECEIVED_COUNT_MISMATCH', 'medium', dealId,
        'מספר התקבולים המדווח אינו תואם למספר הרשומות בהיסטוריה.',
        { received: deal.received, historyEntries: deal.history.length }));
    }

    const seenPayments = new Set();
    deal.history.forEach((payment, paymentIndex) => {
      paymentsChecked += 1;
      if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
        findings.push(finding('INVALID_PAYMENT_RECORD', 'high', dealId,
          'רשומת תקבול אינה תקינה.', { paymentIndex }));
        return;
      }

      if (!Number.isFinite(payment.amount) || payment.amount < 0) {
        findings.push(finding('INVALID_PAYMENT_AMOUNT', 'high', dealId,
          'סכום תקבול חסר או שלילי.', { paymentIndex, amount: payment.amount ?? null }));
      }

      if (payment.date !== undefined && !isValidDate(payment.date)) {
        findings.push(finding('INVALID_PAYMENT_DATE', 'medium', dealId,
          'תאריך התקבול אינו תאריך תקין בפורמט YYYY-MM-DD.',
          { paymentIndex, date: payment.date }));
      }

      const classification = VALID_CLASSIFICATIONS.has(payment.classification)
        ? payment.classification
        : 'unknown';

      if (classification === 'unknown') {
        findings.push(finding('UNCLASSIFIED_PAYMENT', 'info', dealId,
          'התקבול נשמר ללא סיווג קרן או ריבית; לא הונח סיווג אוטומטי.',
          { paymentIndex, amount: payment.amount }));
      }

      if (classification === 'mixed') {
        const principal = payment.principalAmount;
        const interest = payment.interestAmount;
        const validSplit = Number.isFinite(principal) &&
          Number.isFinite(interest) &&
          principal >= 0 &&
          interest >= 0 &&
          Number.isFinite(payment.amount) &&
          Math.abs(principal + interest - payment.amount) < 0.01;

        if (!validSplit) {
          findings.push(finding('INVALID_MIXED_ALLOCATION', 'high', dealId,
            'חלוקת התקבול בין קרן לריבית אינה מסתכמת לסכום התקבול.',
            { paymentIndex, amount: payment.amount,
              principalAmount: principal ?? null, interestAmount: interest ?? null }));
        }
      }

      const key = duplicateKey(payment);
      if (seenPayments.has(key)) {
        findings.push(finding('POSSIBLE_DUPLICATE_PAYMENT', 'high', dealId,
          'נמצאו שתי רשומות תקבול זהות בפרטים הזמינים; נדרשת בדיקה ידנית.',
          { paymentIndex, amount: payment.amount, date: payment.date ?? null }));
      } else {
        seenPayments.add(key);
      }
    });
  });

  return {
    status: 'completed',
    findings,
    summary: {
      dealsChecked: input.length,
      paymentsChecked,
      findings: findings.length,
      bySeverity: findings.reduce((counts, item) => {
        counts[item.severity] = (counts[item.severity] || 0) + 1;
        return counts;
      }, {})
    }
  };
}
