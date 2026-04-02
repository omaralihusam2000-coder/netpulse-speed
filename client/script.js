const els = {
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  statusText: document.getElementById('statusText'),
  progressFill: document.getElementById('progressFill'),
  meterNumber: document.getElementById('meterNumber'),
  gaugeValue: document.getElementById('gaugeValue'),
  downloadValue: document.getElementById('downloadValue'),
  uploadValue: document.getElementById('uploadValue'),
  pingValue: document.getElementById('pingValue'),
  jitterValue: document.getElementById('jitterValue'),
  scoreValue: document.getElementById('scoreValue'),
  qualityValue: document.getElementById('qualityValue'),
  loadedLatencyValue: document.getElementById('loadedLatencyValue'),
  experienceValue: document.getElementById('experienceValue'),
  gamingValue: document.getElementById('gamingValue'),
  streamingValue: document.getElementById('streamingValue'),
  workValue: document.getElementById('workValue'),
  historyTableBody: document.getElementById('historyTableBody'),
};

const GAUGE_ARC = 552.92;
let testing = false;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Number(n.toFixed(1));
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function setProgress(value) {
  els.progressFill.style.width = `${clamp(value, 0, 100)}%`;
}

function setGauge(mbps) {
  const safe = Number.isFinite(mbps) ? mbps : 0;
  const maxDisplay = 1000;
  const ratio = clamp(safe / maxDisplay, 0, 1);
  const dashOffset = GAUGE_ARC * (1 - ratio);
  els.gaugeValue.style.strokeDashoffset = String(dashOffset);
  els.meterNumber.textContent = safe.toFixed(1);
}

function setMetric(idEl, value) {
  idEl.textContent = Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

function calcJitter(samples) {
  if (samples.length < 2) return 0;
  const diffs = [];
  for (let i = 1; i < samples.length; i += 1) {
    diffs.push(Math.abs(samples[i] - samples[i - 1]));
  }
  return diffs.reduce((sum, item) => sum + item, 0) / diffs.length;
}

function calcScore(download, upload, ping, jitter) {
  const a = clamp((download / 300) * 45, 0, 45);
  const b = clamp((upload / 100) * 20, 0, 20);
  const c = clamp(20 - ping / 3, 0, 20);
  const d = clamp(15 - jitter * 2, 0, 15);
  return Math.round(a + b + c + d);
}

function qualityFromScore(score) {
  if (score >= 90) return 'Elite';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Great';
  if (score >= 60) return 'Good';
  return 'Weak';
}

function readiness(download, upload, ping, jitter) {
  const gaming = ping <= 25 && jitter <= 6 ? 'Ideal' : ping <= 45 ? 'Playable' : 'Needs lower latency';
  const streaming = download >= 35 ? 'Smooth 4K' : download >= 20 ? 'Good HD' : 'May buffer';
  const work = upload >= 10 && ping <= 50 ? 'Stable calls' : upload >= 5 ? 'Okay for calls' : 'Weak upload';
  return { gaming, streaming, work };
}

async function pingTest() {
  const samples = [];
  for (let i = 0; i < 6; i += 1) {
    const start = performance.now();
    const res = await fetch(`/api/ping?cb=${Date.now()}_${i}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Ping request failed');
    await res.json();
    const end = performance.now();
    samples.push(end - start);
  }
  const trimmed = samples.slice(1);
  const average = trimmed.reduce((sum, n) => sum + n, 0) / trimmed.length;
  return {
    ping: round1(average),
    jitter: round1(calcJitter(trimmed)),
  };
}

async function downloadTest(seconds = 4, onProgress) {
  const sizeMB = 25;
  let totalBytes = 0;
  const start = performance.now();
  let elapsed = 0;

  while (elapsed < seconds * 1000) {
    const res = await fetch(`/api/download?sizeMB=${sizeMB}&cb=${Date.now()}_${Math.random()}`, { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error('Download request failed');
    const reader = res.body.getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      elapsed = performance.now() - start;
      const mbps = (totalBytes * 8) / (elapsed / 1000) / 1_000_000;
      onProgress(round1(mbps), clamp(15 + (elapsed / (seconds * 1000)) * 40, 15, 55));
      if (elapsed >= seconds * 1000) {
        try { reader.cancel(); } catch (_e) {}
        break;
      }
    }
  }

  const finalElapsed = performance.now() - start;
  return round1((totalBytes * 8) / (finalElapsed / 1000) / 1_000_000);
}

async function uploadTest(seconds = 4, onProgress) {
  const payloadSize = 6 * 1024 * 1024;
  const payload = new Uint8Array(payloadSize);
  crypto.getRandomValues(payload);
  let uploadedBytes = 0;
  const start = performance.now();
  let elapsed = 0;

  while (elapsed < seconds * 1000) {
    const res = await fetch(`/api/upload?cb=${Date.now()}_${Math.random()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store' },
      body: payload,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Upload request failed');
    const data = await res.json();
    uploadedBytes += data.receivedBytes || payloadSize;
    elapsed = performance.now() - start;
    const mbps = (uploadedBytes * 8) / (elapsed / 1000) / 1_000_000;
    onProgress(round1(mbps), clamp(60 + (elapsed / (seconds * 1000)) * 30, 60, 90));
  }

  const finalElapsed = performance.now() - start;
  return round1((uploadedBytes * 8) / (finalElapsed / 1000) / 1_000_000);
}

function saveHistory(entry) {
  const current = JSON.parse(localStorage.getItem('netpulse-history') || '[]');
  current.unshift(entry);
  localStorage.setItem('netpulse-history', JSON.stringify(current.slice(0, 8)));
}

function renderHistory() {
  const history = JSON.parse(localStorage.getItem('netpulse-history') || '[]');
  if (!history.length) {
    els.historyTableBody.innerHTML = '<tr><td colspan="6" class="empty-row">No tests yet</td></tr>';
    return;
  }

  els.historyTableBody.innerHTML = history
    .map((item) => `
      <tr>
        <td>${item.time}</td>
        <td>${item.download.toFixed(1)} Mbps</td>
        <td>${item.upload.toFixed(1)} Mbps</td>
        <td>${item.ping.toFixed(1)} ms</td>
        <td>${item.jitter.toFixed(1)} ms</td>
        <td>${item.score}</td>
      </tr>
    `)
    .join('');
}

function resetUI() {
  setStatus('Ready');
  setProgress(0);
  setGauge(0);
  setMetric(els.downloadValue, 0);
  setMetric(els.uploadValue, 0);
  setMetric(els.pingValue, 0);
  setMetric(els.jitterValue, 0);
  els.scoreValue.textContent = '0';
  els.qualityValue.textContent = 'Ready';
  els.qualityValue.style.color = '#86efac';
  els.loadedLatencyValue.textContent = '0.0 ms';
  els.experienceValue.textContent = 'Idle';
  els.gamingValue.textContent = 'Unknown';
  els.streamingValue.textContent = 'Unknown';
  els.workValue.textContent = 'Unknown';
}

async function startTest() {
  if (testing) return;
  testing = true;
  els.startBtn.disabled = true;

  try {
    setStatus('Measuring latency');
    setProgress(8);
    const { ping, jitter } = await pingTest();
    setMetric(els.pingValue, ping);
    setMetric(els.jitterValue, jitter);
    els.loadedLatencyValue.textContent = `${ping.toFixed(1)} ms`;

    setStatus('Testing download');
    const download = await downloadTest(4, (liveMbps, progress) => {
      setGauge(liveMbps);
      setMetric(els.downloadValue, liveMbps);
      setProgress(progress);
    });
    setGauge(download);
    setMetric(els.downloadValue, download);

    setStatus('Testing upload');
    const upload = await uploadTest(4, (liveMbps, progress) => {
      setMetric(els.uploadValue, liveMbps);
      setProgress(progress);
    });
    setMetric(els.uploadValue, upload);

    const score = calcScore(download, upload, ping, jitter);
    const quality = qualityFromScore(score);
    const ready = readiness(download, upload, ping, jitter);

    els.scoreValue.textContent = String(score);
    els.qualityValue.textContent = quality;
    els.qualityValue.style.color = score >= 80 ? '#86efac' : score >= 60 ? '#fcd34d' : '#fca5a5';
    els.experienceValue.textContent = quality;
    els.gamingValue.textContent = ready.gaming;
    els.streamingValue.textContent = ready.streaming;
    els.workValue.textContent = ready.work;

    setStatus('Finished');
    setProgress(100);

    saveHistory({
      time: new Date().toLocaleString(),
      download,
      upload,
      ping,
      jitter,
      score,
    });
    renderHistory();
  } catch (error) {
    console.error(error);
    setStatus(`Error: ${error.message}`);
  } finally {
    testing = false;
    els.startBtn.disabled = false;
  }
}

els.startBtn.addEventListener('click', startTest);
els.resetBtn.addEventListener('click', resetUI);

resetUI();
renderHistory();
