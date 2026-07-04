(function () {
  'use strict';

  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // DOM refs
  const canvas = qs('#energy');
  const ctx = canvas && canvas.getContext && canvas.getContext('2d');
  let toastEl = qs('#toast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'toast';
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }

  // Calc controls
  const pilesEl = qs('#piles');
  const pilesValEl = qs('#pilesVal');
  const ordersEl = qs('#orders');
  const ordersValEl = qs('#ordersVal');
  const feeEl = qs('#fee');
  const feeValEl = qs('#feeVal');

  const avgKwhEl = qs('#avgKwh');
  const avgKwhValEl = qs('#avgKwhVal');
  const priceKwhEl = qs('#priceKwh');
  const priceKwhValEl = qs('#priceKwhVal');

  const dayIncomeEl = qs('#dayIncome');
  const monthIncomeEl = qs('#monthIncome');
  const yearIncomeEl = qs('#yearIncome');

  const STORAGE_KEY = 'charging-pile1:calc';

  // Canvas state
  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let width = 0;
  let height = 0;
  let nodes = [];
  let rafId = null;
  let lastTs = 0;

  function showToast(text, ms = 1800) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function createNodes(count = 14) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: Math.random(),
        y: Math.random(),
        amp: 8 + Math.random() * 40,
        speed: 0.2 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        hue: 180 + Math.random() * 120
      });
    }
    return out;
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    DPR = Math.max(1, window.devicePixelRatio || 1);
    width = Math.max(300, Math.floor(window.innerWidth * DPR));
    height = Math.max(200, Math.floor(window.innerHeight * DPR));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${Math.floor(width / DPR)}px`;
    canvas.style.height = `${Math.floor(height / DPR)}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const approx = Math.round(Math.max(8, Math.min(36, (width / DPR) / 40)));
    nodes = createNodes(approx);
  }

  function draw(t) {
    if (!ctx) return;
    const dt = t - (lastTs || t);
    lastTs = t;

    ctx.clearRect(0, 0, width, height);

    nodes.forEach((n) => {
      n.phase += n.speed * (dt / 16);
      const px = (n.x * (width / DPR)) + Math.sin(n.phase) * n.amp;
      const py = (n.y * (height / DPR)) + Math.cos(n.phase * 0.9) * (n.amp * 0.6);

      const g = ctx.createLinearGradient(0, 0, width / DPR, height / DPR);
      const c1 = `hsla(${Math.round(n.hue)}, 95%, 60%, 0.12)`;
      const c2 = `hsla(${Math.round((n.hue + 90) % 360)}, 95%, 60%, 0.02)`;
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);

      ctx.strokeStyle = g;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(n.phase) * 18, py + Math.sin(n.phase * 1.1) * 12,
                           px + Math.sin(n.phase * 0.5) * 40, py + Math.cos(n.phase * 0.7) * 24);
      ctx.stroke();
    });

    rafId = window.requestAnimationFrame(draw);
  }

  function startAnim() {
    if (rafId) return;
    lastTs = 0;
    rafId = window.requestAnimationFrame(draw);
  }
  function stopAnim() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnim();
    else startAnim();
  });

  function downloadText(filename, text) {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('已开始下载');
    } catch (e) {
      console.error(e);
      showToast('下载失败');
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast('已复制到剪贴板');
    } catch (err) {
      console.error(err);
      showToast('复制失败');
    }
  }

  const docsMap = {
    '场地勘查信息表': '【场地勘查信息表】\n请填写车位数量、变压器容量、接入点、产权信息等。',
    '建设授权与合作确认书': '【建设授权与合作确认书】\n示例：场地方授权建设、施工进场、运营分账说明。',
    '项目备案资料包': '【项目备案资料包】\n包含项目主体、建设地点、设备清单等。',
    '电力报装增容资料': '【电力报装/增容资料】\n用于供电所沟通容量和接入方式。',
    '施工组织与安全方案': '【施工组织/安全方案】\n施工范围、消防通道、应急处理。',
    '设备清单与运营方案': '【设备清单/运营方案】\n设备参数、平台接入、运维说明。'
  };

  function initDocButtons() {
    qsa('button[data-doc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.doc;
        const text = docsMap[name] || `${name}\n说明：请自定义内容。`;
        downloadText(`${name}.txt`, text);
      });
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      console.warn(e);
    }
  }

  function formatWan(v) {
    if (v >= 10000) return `${(v / 10000).toFixed(2)}万`;
    return `${Math.round(v)}`;
  }

  function computeAndUpdate() {
    const piles = Number(pilesEl.value);
    const orders = Number(ordersEl.value);
    const fee = Number(feeEl.value);
    const avgKwh = Number((avgKwhEl && avgKwhEl.value) || 20);
    const priceKwh = Number((priceKwhEl && priceKwhEl.value) || 1.2);

    const dayService = piles * orders * fee;
    const dayEnergy = piles * orders * avgKwh * priceKwh;
    const dayTotal = dayService + dayEnergy;
    const monthTotal = dayTotal * 30;
    const yearTotal = monthTotal * 12;

    if (dayIncomeEl) dayIncomeEl.textContent = formatWan(dayTotal);
    if (monthIncomeEl) monthIncomeEl.textContent = formatWan(monthTotal);
    if (yearIncomeEl) yearIncomeEl.textContent = formatWan(yearTotal);

    if (pilesValEl) pilesValEl.textContent = piles;
    if (ordersValEl) ordersValEl.textContent = orders;
    if (feeValEl) feeValEl.textContent = fee;
    if (avgKwhValEl) avgKwhValEl.textContent = avgKwh;
    if (priceKwhValEl) priceKwhValEl.textContent = priceKwh;

    saveState({ piles, orders, fee, avgKwh, priceKwh, ts: Date.now() });
  }

  function initCalc() {
    const inputs = [pilesEl, ordersEl, feeEl, avgKwhEl, priceKwhEl].filter(Boolean);
    inputs.forEach((el) => el.addEventListener('input', computeAndUpdate));

    const s = loadState();
    if (s) {
      if (pilesEl && typeof s.piles !== 'undefined') pilesEl.value = s.piles;
      if (ordersEl && typeof s.orders !== 'undefined') ordersEl.value = s.orders;
      if (feeEl && typeof s.fee !== 'undefined') feeEl.value = s.fee;
      if (avgKwhEl && typeof s.avgKwh !== 'undefined') avgKwhEl.value = s.avgKwh;
      if (priceKwhEl && typeof s.priceKwh !== 'undefined') priceKwhEl.value = s.priceKwh;
    }

    computeAndUpdate();
  }

  function init() {
    if (canvas && ctx) {
      resizeCanvas();
      window.addEventListener('resize', () => resizeCanvas(), { passive: true });
      startAnim();
    }
    initDocButtons();
    initCalc();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.addEventListener('beforeunload', () => stopAnim());
})();
