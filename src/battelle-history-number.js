export const HISTORY_NUMBER_MAX_LENGTH = 50;

export function normalizeHistoryNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new TypeError('El número de historia debe ser texto.');
  if (/[\u0000-\u001F\u007F]/u.test(value)) throw new TypeError('El número de historia contiene caracteres no permitidos.');
  const normalized = value.trim().replace(/\s+/gu, ' ').toUpperCase();
  if (!normalized) throw new TypeError('El número de historia no puede estar vacío.');
  if (normalized.length > HISTORY_NUMBER_MAX_LENGTH) throw new TypeError('El número de historia supera 50 caracteres.');
  if (/[\u0000-\u001F\u007F]/u.test(normalized) || /[<>]/u.test(normalized)) throw new TypeError('El número de historia contiene caracteres no permitidos.');
  return normalized;
}

export function tryNormalizeHistoryNumber(value) { try { return normalizeHistoryNumber(value); } catch { return null; } }
export function historyNumberLabel(value) { return tryNormalizeHistoryNumber(value) ?? 'Sin asignar'; }
export function assessmentsBelongToSamePatient(a,b) { const left=tryNormalizeHistoryNumber(a?.historyNumber),right=tryNormalizeHistoryNumber(b?.historyNumber); return Boolean(left&&right&&left===right); }
export function findCorrectedAssessmentsByHistoryNumber(records,historyNumber,excludeId=null) { const nh=tryNormalizeHistoryNumber(historyNumber); if(!nh||!Array.isArray(records)) return []; return records.filter(record=>record?.id!==excludeId&&record?.deletedAt==null&&record?.workflowStatus==='corregida'&&tryNormalizeHistoryNumber(record.historyNumber)===nh).slice().sort((a,b)=>String(a.assessmentDate||'').localeCompare(String(b.assessmentDate||''))); }
export function createFollowUpAssessmentSeed(source,now=new Date()) { return {historyNumber:normalizeHistoryNumber(source?.historyNumber),name:typeof source?.name==='string'?source.name:'',birthDate:typeof source?.birthDate==='string'?source.birthDate:'',therapistName:source?.therapistName??null,assessmentDate:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}; }
