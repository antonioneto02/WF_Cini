const adminMaintenanceRepository = require('../repositories/adminMaintenanceRepository');

const REQUIRED_CONFIRM_TEXT = 'DELETAR TUDO';

function normalizeConfirmText(value) {
  return String(value || '').trim().toUpperCase();
}

async function purgeAllWorkflowData({ confirmText, actor }) {
  if (normalizeConfirmText(confirmText) !== REQUIRED_CONFIRM_TEXT) {
    const error = new Error(`Confirmacao invalida. Digite exatamente: ${REQUIRED_CONFIRM_TEXT}`);
    error.statusCode = 400;
    throw error;
  }

  const summary = await adminMaintenanceRepository.purgeAllWorkflowData();
  const deletedTotal = summary.reduce((acc, item) => acc + Number(item.deleted || 0), 0);

  return {
    ok: true,
    requiredConfirmation: REQUIRED_CONFIRM_TEXT,
    deletedTotal,
    summary,
    triggeredBy: actor || 'sistema',
    executedAt: new Date().toISOString(),
  };
}

module.exports = {
  REQUIRED_CONFIRM_TEXT,
  purgeAllWorkflowData,
};
