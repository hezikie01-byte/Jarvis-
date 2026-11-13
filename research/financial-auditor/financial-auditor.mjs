/**
 * J.A.R.V.I.S. read-only financial data auditor prototype.
 * Validates the current InvestmentDeals.tsx record shape and reports
 * evidence-backed anomalies only. Never mutates or repairs input.
 */
const VALID_CLASSIFICATIONS = new Set(['principal', 'interest', 'mixed', 'unknown']);
const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
function finding(code, severity, dealId, message, evidence = {}) {
  return { code, severity, dealId, message, evidence };
}
function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function duplicateKey(payment) {
  return JSON.stringify([payment.date ?? null, payment.amount,
    payment.classification ?? 'unknown', payment.principalAmount ?? null,
    payment.interestAmount ?? null, payment.note ?? null]);
}
function invalidString(value) { return typeof value !== 'string' || value.trim() === ''; }

export function auditInvestmentDeals(input) {
  if (!Array.isArray(input)) {
    return { status: 'invalid_input',
      findings: [finding('INVALID_COLLECTION', 'critical', null, 'רשימת העסקאות אינה מערך תקין.')],
      summary: { dealsChecked: 0, paymentsChecked: 0, findings: 1 } };
  }
  const findings = [];
  let paymentsChecked = 0;
  const seenDealIds = new Set();
  input.forEach((deal, dealIndex) => {
    const dealId = deal && typeof deal.id === 'string' ? deal.id : null;
    if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
      findings.push(finding('INVALID_DEAL_RECORD', 'critical', null,
        'רשומת עסקה אינה אובייקט תקין.', { dealIndex }));
      return;
    }
    if (invalidString(deal.id)) findings.push(finding('MISSING_DEAL_ID', 'high', null,
      'לעסקה חסר מזהה יציב.', { dealIndex }));
    else if (seenDealIds.has(deal.id)) findings.push(finding('DUPLICATE_DEAL_ID', 'critical',
      dealId, 'נמצא יותר מרישום עסקה אחד עם אותו מזהה.'));
    else seenDealIds.add(deal.id);

    for (const field of ['title', 'source', 'dueLabel']) {
      if (invalidString(deal[field])) findings.push(finding('INVALID_DEAL_FIELD', 'high',
        dealId, 'שדה טקסט נדרש חסר או ריק.', { field }));
    }
    if (!['fixed', 'declining'].includes(deal.kind)) findings.push(finding(
      'INVALID_DEAL_KIND', 'high', dealId, 'סוג העסקה אינו fixed או declining.',
      { kind: deal.kind ?? null }));
    if (!['monthly', 'weekly'].includes(deal.cadence)) findings.push(finding(
      'INVALID_DEAL_CADENCE', 'high', dealId, 'תדירות התשלום אינה monthly או weekly.',
      { cadence: deal.cadence ?? null }));
    for (const field of ['principal', 'payment']) {
      if (!Number.isFinite(deal[field]) || deal[field] < 0) findings.push(finding(
        'INVALID_DEAL_AMOUNT', 'high', dealId, 'סכום העסקה חסר או אינו תקין.',
        { field, value: deal[field] ?? null }));
    }
    if (!Number.isFinite(deal.received) || deal.received < 0) findings.push(finding(
      'INVALID_RECEIVED_COUNT', 'high', dealId, 'מונה התקבולים חסר או אינו תקין.',
      { received: deal.received ?? null }));
    if (deal.remaining !== undefined &&
        (!Number.isFinite(deal.remaining) || deal.remaining < 0)) findings.push(finding(
      'INVALID_REMAINING_COUNT', 'high', dealId, 'מספר התשלומים שנותרו אינו תקין.',
      { remaining: deal.remaining ?? null }));

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
      if (!Number.isFinite(payment.amount) || payment.amount < 0) findings.push(finding(
        'INVALID_PAYMENT_AMOUNT', 'high', dealId, 'סכום תקבול חסר או שלילי.',
        { paymentIndex, amount: payment.amount ?? null }));
      if (payment.date !== undefined && !isValidDate(payment.date)) findings.push(finding(
        'INVALID_PAYMENT_DATE', 'medium', dealId,
        'תאריך התקבול אינו תאריך תקין בפורמט YYYY-MM-DD.',
        { paymentIndex, date: payment.date }));
      if (payment.note !== undefined && typeof payment.note !== 'string') findings.push(finding(
        'INVALID_PAYMENT_NOTE', 'medium', dealId, 'הערת התקבול חייבת להיות טקסט.',
        { paymentIndex }));
      const classification = VALID_CLASSIFICATIONS.has(payment.classification)
        ? payment.classification : 'unknown';
      if (classification === 'unknown') findings.push(finding('UNCLASSIFIED_PAYMENT', 'info',
        dealId, 'התקבול נשמר ללא סיווג קרן או ריבית; לא הונח סיווג אוטומטי.',
        { paymentIndex, amount: payment.amount }));
      if (classification === 'mixed') {
        const principal = payment.principalAmount;
        const interest = payment.interestAmount;
        const validSplit = Number.isFinite(principal) && Number.isFinite(interest) &&
          principal >= 0 && interest >= 0 && Number.isFinite(payment.amount) &&
          Math.abs(principal + interest - payment.amount) < 0.01;
        if (!validSplit) findings.push(finding('INVALID_MIXED_ALLOCATION', 'high', dealId,
          'חלוקת התקבול בין קרן לריבית אינה מסתכמת לסכום התקבול.',
          { paymentIndex, amount: payment.amount, principalAmount: principal ?? null,
            interestAmount: interest ?? null }));
      }
      const key = duplicateKey(payment);
      if (seenPayments.has(key)) findings.push(finding('POSSIBLE_DUPLICATE_PAYMENT', 'high',
        dealId, 'נמצאו שתי רשומות תקבול זהות בפרטים הזמינים; נדרשת בדיקה ידנית.',
        { paymentIndex, amount: payment.amount, date: payment.date ?? null }));
      else seenPayments.add(key);
    });
  });
  return { status: 'completed', findings, summary: {
    dealsChecked: input.length, paymentsChecked, findings: findings.length,
    bySeverity: findings.reduce((counts, item) => {
      counts[item.severity] = (counts[item.severity] || 0) + 1;
      return counts;
    }, {})
  }};
}
