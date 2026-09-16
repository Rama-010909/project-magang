import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { app } from './firebase';

let modelPromise;

async function getModel() {
  if (!modelPromise) {
    modelPromise = Promise.resolve().then(() => {
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      return getGenerativeModel(ai, { model: 'gemini-3.8-flash' });
    });
  }
  return modelPromise;
}

function fallbackAnalysis(rows) {
  const offline = rows.filter(r => r.online === false);
  const trouble = rows.filter(r => r.internetStatus === 'trouble' || r.internetOnline === false);
  const unknownInternet = rows.filter(r => r.online === true && !['normal', 'trouble'].includes(String(r.internetStatus || '').toLowerCase()));
  const online = rows.filter(r => r.online === true);
  const lines = [];
  lines.push(`Perangkat dipantau: ${rows.length}. Online: ${online.length}. Offline: ${offline.length}.`);
  if (offline.length) lines.push(`Offline: ${offline.map(r => r.nama || r.kodeAset).join(', ')}.`);
  if (trouble.length) lines.push(`Internet trouble: ${trouble.map(r => r.nama || r.kodeAset).join(', ')}.`);
  if (unknownInternet.length) lines.push(`${unknownInternet.length} perangkat belum memiliki data internet yang dapat diverifikasi.`);
  if (!offline.length && !trouble.length) lines.push('Tidak ada gangguan yang terdeteksi dari data monitoring saat ini.');
  return lines.join(' ');
}

export async function analyzeMonitoringWithAI(rows) {
  const normalized = rows.map(r => ({
    kodeAset: r.kodeAset || r.assetId || '',
    nama: r.nama || r.name || 'Perangkat',
    kategori: r.kategori || '',
    ipAddress: r.ipAddress || '',
    online: typeof r.online === 'boolean' ? r.online : null,
    deviceStatus: r.deviceStatus || '',
    internetStatus: r.internetStatus || 'Belum Diperiksa',
    internetOnline: typeof r.internetOnline === 'boolean' ? r.internetOnline : null,
    method: r.method || '',
    reason: r.reason || '',
    checkedAt: r.checkedAt || null
  }));

  if (!normalized.length) return { text: 'Belum ada perangkat yang dapat dianalisis.', source: 'local' };

  try {
    const model = await getModel();
    const prompt = `Kamu adalah AI analis jaringan untuk sistem IT Asset Monitoring. Analisis DATA MONITORING berikut. Jangan menebak data yang tidak ada. Bedakan status perangkat dengan status internet. Jika internetStatus = Belum Diperiksa, katakan belum dapat diverifikasi. Berikan jawaban Bahasa Indonesia yang singkat dan teknis dengan bagian: Ringkasan, Gangguan, Prioritas pemeriksaan. Jangan menyatakan penyebab sebagai kepastian jika hanya indikasi.\n\nDATA:\n${JSON.stringify(normalized)}`;
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    if (text.trim()) return { text: text.trim(), source: 'gemini' };
  } catch (error) {
    console.warn('[AI MONITOR] Gemini tidak tersedia, memakai analisis lokal:', error);
  }

  return { text: fallbackAnalysis(normalized), source: 'local' };
}
