import { useState, useEffect, useCallback, useMemo } from "react";
import * as Recharts from "recharts";

const {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} = Recharts;

/* ════════════════════════════════════════════
   THEME — Swiss Editorial Finance
   ════════════════════════════════════════════ */
const C = {
  bg: "#F3F5F7",
  white: "#FFFFFF",
  card: "#FFFFFF",
  border: "#DDE3EA",
  borderLight: "#EEF2F6",
  accent: "#0F766E",
  accentDark: "#115E59",
  accentLight: "#E6F4F1",
  fire: "#B7791F",
  fireLight: "#FFF7E6",
  blue: "#334155",
  blueLight: "#F1F5F9",
  purple: "#475569",
  red: "#B91C1C",
  text: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  inputBg: "#FFFFFF",
  inputBorder: "#CBD5E1",
  shadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.04)",
  shadowMd: "0 12px 32px rgba(15,23,42,0.10)",
};

const FONT = `'Inter', 'Libre Franklin', 'Source Sans Pro', sans-serif`;
const MONO = `'IBM Plex Mono', 'Fira Code', monospace`;

/* ═══ UTILITIES ═══ */
const fmt = (n) => {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${Math.round(n).toLocaleString()}`;
};
const fmtFull = (n) => `$${Math.round(n).toLocaleString()}`;
const pctFmt = (n) => `${n.toFixed(1)}%`;

function randNormal(mean, std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ═══ COMPUTATION ═══ */
function computeFixed(inp) {
  const fireTarget = inp.retirementSpending / (inp.withdrawalRate / 100);
  const blend = (inp.stockPct / 100) * (inp.stockReturn / 100) + (inp.bondPct / 100) * (inp.bondReturn / 100) + (inp.cashPct / 100) * 0.001;
  const data = [];
  let saved = inp.investments, rets = 0, contrib = inp.investments, inc = inp.income, retireAge = null;
  for (let y = 0; y <= 40; y++) {
    const a = inp.age + y;
    let extra = 0;
    if (a >= inp.extraIncStart && a <= inp.extraIncEnd) extra += inp.extraIncome;
    if (a >= inp.extraExpStart && a <= inp.extraExpEnd) extra -= inp.extraExpense;
    const yearSave = inc - inp.spending + extra;
    const yearRet = saved * blend;
    rets += yearRet;
    saved += yearSave + yearRet;
    if (y > 0) contrib += Math.max(0, yearSave);
    if (saved >= fireTarget && !retireAge) retireAge = a;
    data.push({ age: a, saved: Math.max(0, saved), returns: Math.max(0, rets), contributions: Math.max(0, contrib), fireTarget });
    inc *= 1 + inp.incomeGrowth / 100;
  }
  return { data, fireTarget, retireAge, yearsToRetire: retireAge ? retireAge - inp.age : null };
}

function computeHistorical(inp) {
  const fireTarget = inp.retirementSpending / (inp.withdrawalRate / 100);

  // ═══ SHILLER DATA: S&P Composite nominal total returns (price + dividends), 1872–2024 ═══
  // Source: Robert Shiller, ie_data.xls from shillerdata.com
  // Each value = annual total return as decimal (e.g., 0.12 = 12%)
  // Years: 1872, 1873, 1874, ... 2024 (153 years)
  const sH = [
    // 1872-1879
    0.1241, -0.0356, 0.0353, 0.0566, -0.0258, 0.0617, 0.1178, 0.1802,
    // 1880-1889
    0.2356, -0.0510, 0.0150, -0.0849, -0.1857, 0.2613, 0.1232, -0.0106, 0.0155, 0.0556,
    // 1890-1899
    -0.0651, 0.1745, -0.0581, -0.1398, -0.0393, 0.0461, -0.0188, 0.2031, 0.2286, 0.0144,
    // 1900-1909
    0.1507, 0.1581, -0.0013, -0.0357, 0.0432, 0.2089, -0.0153, -0.2466, 0.3854, 0.1507,
    // 1910-1919
    -0.0327, 0.0168, 0.0061, -0.1005, -0.0590, 0.0178, 0.0156, -0.2131, 0.2296, 0.2019,
    // 1920-1929
    -0.1543, 0.1179, 0.2807, 0.0340, 0.2499, 0.2966, 0.1162, 0.3749, 0.4361, -0.0842,
    // 1930-1939
    -0.2490, -0.4334, -0.0819, 0.5399, -0.0144, 0.4768, 0.3392, -0.3512, 0.3112, -0.0041,
    // 1940-1949
    -0.0978, -0.1159, 0.2034, 0.2590, 0.1975, 0.3644, -0.0807, 0.0571, 0.0550, 0.1879,
    // 1950-1959
    0.3171, 0.2402, 0.1837, -0.0099, 0.5262, 0.3156, 0.0656, -0.1078, 0.4336, 0.1196,
    // 1960-1969
    0.0047, 0.2689, -0.0873, 0.2280, 0.1648, 0.1245, -0.1006, 0.2398, 0.1106, -0.0850,
    // 1970-1979
    0.0401, 0.1431, 0.1898, -0.1466, -0.2647, 0.3720, 0.2384, -0.0718, 0.0656, 0.1844,
    // 1980-1989
    0.3242, -0.0491, 0.2141, 0.2251, 0.0627, 0.3173, 0.1867, 0.0525, 0.1661, 0.3169,
    // 1990-1999
    -0.0310, 0.3047, 0.0762, 0.1008, 0.0132, 0.3758, 0.2296, 0.3336, 0.2858, 0.2104,
    // 2000-2009
    -0.0910, -0.1189, -0.2210, 0.2868, 0.1088, 0.0491, 0.1579, 0.0549, -0.3700, 0.2646,
    // 2010-2019
    0.1506, 0.0211, 0.1600, 0.3239, 0.1369, 0.0138, 0.1196, 0.2183, -0.0438, 0.3149,
    // 2020-2024
    0.1840, 0.2861, -0.1821, 0.2629, 0.2508
  ];

  // ═══ SHILLER DATA: 10-Year US Treasury Bond nominal returns, 1872–2024 ═══
  // Derived from Shiller's GS10 interest rate series (approximate total return = yield + price change)
  const bH = [
    // 1872-1879
    0.0680, 0.0587, 0.0574, 0.0559, 0.0566, 0.0536, 0.0477, 0.0441,
    // 1880-1889
    0.0602, 0.0392, 0.0369, 0.0364, 0.0345, 0.0333, 0.0341, 0.0349, 0.0355, 0.0368,
    // 1890-1899
    0.0347, 0.0377, 0.0370, 0.0453, 0.0332, 0.0338, 0.0364, 0.0345, 0.0332, 0.0319,
    // 1900-1909
    0.0310, 0.0312, 0.0331, 0.0348, 0.0359, 0.0346, 0.0363, 0.0377, 0.0399, 0.0372,
    // 1910-1919
    0.0365, 0.0381, 0.0404, 0.0439, 0.0436, 0.0449, 0.0431, 0.0458, 0.0597, 0.0531,
    // 1920-1929
    0.0546, 0.0509, 0.0432, 0.0436, 0.0406, 0.0386, 0.0368, 0.0334, 0.0355, 0.0342,
    // 1930-1939
    0.0429, 0.0555, 0.0868, 0.0101, 0.0400, 0.0502, 0.0347, 0.0268, 0.0515, 0.0396,
    // 1940-1949
    0.0504, 0.0356, 0.0297, 0.0258, 0.0264, 0.0360, 0.0172, 0.0163, 0.0195, 0.0345,
    // 1950-1959
    0.0032, -0.0030, 0.0127, 0.0363, 0.0700, -0.0130, -0.0259, 0.0745, -0.0221, -0.0226,
    // 1960-1969
    0.1187, 0.0206, 0.0569, 0.0121, 0.0351, -0.0093, 0.0365, -0.0919, 0.0257, -0.0508,
    // 1970-1979
    0.1210, 0.1324, 0.0568, -0.0111, 0.0435, 0.0919, 0.1675, 0.0169, -0.0116, -0.0123,
    // 1980-1989
    -0.0395, 0.0186, 0.4036, 0.0065, 0.1543, 0.3097, 0.2443, -0.0275, 0.0967, 0.1811,
    // 1990-1999
    -0.0503, 0.1930, 0.0806, 0.1824, -0.0778, 0.3167, -0.0093, 0.1298, 0.1492, -0.0925,
    // 2000-2009
    0.2111, 0.0324, 0.1764, 0.0138, 0.0451, 0.0287, 0.0133, 0.1003, 0.2022, -0.1112,
    // 2010-2019
    0.0841, 0.1704, 0.0297, -0.0917, 0.1075, 0.0130, 0.0069, 0.0275, -0.0002, 0.0917,
    // 2020-2024
    0.1140, -0.0439, -0.1746, 0.0396, -0.0317
  ];

  const N = sH.length, paths = [], retireAges = [];
  for (let s = 0; s < N; s++) {
    let saved = inp.investments, inc = inp.income;
    const path = [];
    let retired = false;
    for (let y = 0; y <= 35; y++) {
      const a = inp.age + y;
      let extra = 0;
      if (a >= inp.extraIncStart && a <= inp.extraIncEnd) extra += inp.extraIncome;
      if (a >= inp.extraExpStart && a <= inp.extraExpEnd) extra -= inp.extraExpense;
      const r = saved * ((inp.stockPct / 100) * sH[(s + y) % N] + (inp.bondPct / 100) * bH[(s + y) % N]);
      saved += (inc - inp.spending + extra) + r;
      saved = Math.max(0, saved);
      path.push({ age: a, saved });
      if (saved >= fireTarget && !retired) { retireAges.push(a); retired = true; }
      inc *= 1 + inp.incomeGrowth / 100;
    }
    paths.push(path);
  }
  const data = [];
  for (let y = 0; y <= 35; y++) {
    const vals = paths.map(p => p[y].saved).sort((a, b) => a - b);
    const pc = (p) => vals[Math.floor(vals.length * p / 100)] || 0;
    data.push({ age: inp.age + y, p5: pc(5), p10: pc(10), p25: pc(25), median: pc(50), p75: pc(75), p90: pc(90), p95: pc(95), fireTarget });
  }
  retireAges.sort((a, b) => a - b);
  const med = retireAges.length > 0 ? retireAges[Math.floor(retireAges.length / 2)] : null;
  return { data, fireTarget, retireAge: med, yearsToRetire: med ? med - inp.age : null,
    p10: retireAges.length > 0 ? retireAges[Math.floor(retireAges.length * 0.1)] : null,
    p90: retireAges.length > 0 ? retireAges[Math.floor(retireAges.length * 0.9)] : null,
    successRate: ((retireAges.length / paths.length) * 100).toFixed(0), totalCycles: paths.length };
}

function computeMC(inp, n = 500) {
  const fireTarget = inp.retirementSpending / (inp.withdrawalRate / 100);
  const retireAges = [], finals = [];
  const allPercentiles = [];
  const allPaths = [];
  for (let s = 0; s < n; s++) {
    let saved = inp.investments, inc = inp.income;
    const path = [];
    let retired = false;
    for (let y = 0; y <= 35; y++) {
      const a = inp.age + y;
      let extra = 0;
      if (a >= inp.extraIncStart && a <= inp.extraIncEnd) extra += inp.extraIncome;
      if (a >= inp.extraExpStart && a <= inp.extraExpEnd) extra -= inp.extraExpense;
      const sr = randNormal(inp.stockReturn / 100, 0.175);
      const br = randNormal(inp.bondReturn / 100, 0.06);
      saved += (inc - inp.spending + extra) + saved * ((inp.stockPct / 100) * sr + (inp.bondPct / 100) * br + (inp.cashPct / 100) * 0.001);
      saved = Math.max(0, saved);
      path.push(saved);
      if (saved >= fireTarget && !retired) { retireAges.push(a); retired = true; }
      inc *= 1 + inp.incomeGrowth / 100;
    }
    allPaths.push(path);
    finals.push(saved);
  }
  const data = [];
  for (let y = 0; y <= 35; y++) {
    const vals = allPaths.map(p => p[y]).sort((a, b) => a - b);
    const pc = (p) => vals[Math.floor(vals.length * p / 100)] || 0;
    data.push({ age: inp.age + y, p5: pc(5), p10: pc(10), p25: pc(25), median: pc(50), p75: pc(75), p90: pc(90), p95: pc(95), fireTarget });
  }
  retireAges.sort((a, b) => a - b);
  finals.sort((a, b) => a - b);
  const med = retireAges.length > 0 ? retireAges[Math.floor(retireAges.length / 2)] : null;

  const retireHist = [];
  if (retireAges.length > 0) {
    for (let a = Math.min(...retireAges); a <= Math.max(...retireAges); a++) {
      const c = retireAges.filter(r => r === a).length;
      if (c > 0) retireHist.push({ age: a, count: c });
    }
  }

  const bins = 18;
  const minV = Math.min(...finals), maxV = Math.max(...finals), sz = (maxV - minV) / bins;
  const histogram = [];
  for (let i = 0; i < bins; i++) {
    const lo = minV + i * sz, hi = lo + sz;
    histogram.push({ range: fmt(lo + sz / 2), count: finals.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length });
  }

  return { data, fireTarget, retireAge: med, yearsToRetire: med ? med - inp.age : null,
    successRate: ((retireAges.length / n) * 100).toFixed(1),
    p10: retireAges.length > 0 ? retireAges[Math.floor(retireAges.length * 0.1)] : null,
    p90: retireAges.length > 0 ? retireAges[Math.floor(retireAges.length * 0.9)] : null,
    numSims: n, histogram, retireHist,
    avgFinal: finals.reduce((a, b) => a + b, 0) / n,
    medianFinal: finals[Math.floor(n / 2)] };
}

function computeSensitivity(inp) {
  const data = [];
  for (let s = Math.max(5000, inp.spending - 20000); s <= inp.spending + 15000; s += 2500) {
    const r = computeFixed({ ...inp, spending: s, retirementSpending: Math.round(s * 0.889) });
    data.push({ spending: s, years: r.yearsToRetire ?? 45 });
  }
  return data;
}

function computeSRSensitivity(inp) {
  const data = [];
  for (let rate = 5; rate <= 70; rate += 5) {
    const sp = inp.income * (1 - rate / 100);
    const r = computeFixed({ ...inp, spending: sp, retirementSpending: Math.round(sp * 0.889) });
    data.push({ rate, years: r.yearsToRetire ?? 45 });
  }
  return data;
}

/* ═══ UI ATOMS ═══ */
const Input = ({ label, value, onChange, prefix, suffix, min, max, step = 1 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
    <label style={{ fontSize: 10, fontFamily: MONO, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500 }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: "0 10px", height: 36 }}>
      {prefix && <span style={{ color: C.textTertiary, fontSize: 13, fontFamily: MONO, marginRight: 3 }}>{prefix}</span>}
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max} step={step}
        style={{ background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 13, fontFamily: MONO, width: "100%", fontWeight: 500 }} />
      {suffix && <span style={{ color: C.textTertiary, fontSize: 11, fontFamily: MONO, marginLeft: 3 }}>{suffix}</span>}
    </div>
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden", ...style }}>{children}</div>
);

const Metric = ({ label, value, sub, color = C.accent }) => (
  <div style={{ padding: "18px 20px", borderRight: `1px solid ${C.borderLight}`, flex: 1, minWidth: 170 }}>
    <div style={{ fontSize: 10, fontFamily: MONO, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 7, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: 25, fontFamily: MONO, color, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.03em" }}>{value}</div>
    {sub && <div style={{ fontSize: 12, fontFamily: FONT, color: C.textSecondary, marginTop: 5 }}>{sub}</div>}
  </div>
);

const Tab = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    background: active ? C.text : C.white, color: active ? "#fff" : C.textSecondary,
    border: `1px solid ${active ? C.text : C.border}`, borderRadius: 999, padding: "8px 16px",
    fontSize: 12, fontFamily: FONT, fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all 0.15s",
    boxShadow: active ? "0 6px 16px rgba(15,23,42,0.12)" : "none",
  }}>{children}</button>
);

const Header = ({ children, right }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px 13px", borderBottom: `1px solid ${C.borderLight}` }}>
    <h3 style={{ fontSize: 14, fontFamily: FONT, color: C.text, fontWeight: 750, margin: 0, letterSpacing: "-0.01em" }}>{children}</h3>
    {right}
  </div>
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: MONO, boxShadow: C.shadowMd, fontSize: 12 }}>
      <div style={{ color: C.text, fontWeight: 600, marginBottom: 5 }}>Age {label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color || C.textSecondary, marginBottom: 1, display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{p.name}</span><span style={{ fontWeight: 600 }}>{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ═══ PDF EXPORT ═══ */
function exportPDF(inp, fixed, mc) {
  const w = window.open('', '_blank');
  if (!w) { alert('Allow popups for PDF export'); return; }
  const savings = inp.income - inp.spending;
  const sr = ((savings / inp.income) * 100).toFixed(1);
  const blend = ((inp.stockPct / 100) * inp.stockReturn + (inp.bondPct / 100) * inp.bondReturn).toFixed(2);
  w.document.write(`<!DOCTYPE html><html><head><title>Retire When? Plan</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;color:#0F172A;padding:44px 52px;max-width:820px;margin:0 auto;line-height:1.5}
h1{font-size:24px;font-weight:700;color:#0F172A;letter-spacing:-0.03em}
.sub{color:#94A3B8;font-size:11px;margin-bottom:24px;font-family:'IBM Plex Mono',monospace}
h2{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0F766E;margin:24px 0 8px;padding-bottom:5px;border-bottom:2px solid #E6F4F1}
.g{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:6px}
.m{background:#F7F8FA;border:1px solid #E8ECF1;border-radius:7px;padding:12px 14px}
.ml{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#94A3B8;font-family:'IBM Plex Mono',monospace;font-weight:500}
.mv{font-size:20px;font-weight:700;font-family:'IBM Plex Mono',monospace;margin-top:2px}
.grn{color:#0F766E}.amb{color:#B7791F}
table{width:100%;border-collapse:collapse;margin:4px 0;font-size:12px}
th,td{padding:6px 12px;text-align:left;border-bottom:1px solid #E8ECF1}
th{background:#F7F8FA;font-weight:600;font-size:9.5px;text-transform:uppercase;letter-spacing:0.06em;color:#64748B;font-family:'IBM Plex Mono',monospace}
td{font-family:'IBM Plex Mono',monospace;font-size:11.5px}
.n{margin-top:28px;padding:14px;background:#F7F8FA;border:1px solid #E8ECF1;border-radius:7px;font-size:10.5px;color:#64748B;line-height:1.6}
@media print{body{padding:20px 28px}}
</style></head><body>
<h1>Retire When?</h1>
<div class="sub">Retirement timing summary · Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
<div class="g">
<div class="m"><div class="ml">Retirement Target</div><div class="mv amb">${fmtFull(fixed.fireTarget)}</div></div>
<div class="m"><div class="ml">Base Case</div><div class="mv grn">${fixed.yearsToRetire ?? 'N/A'} yrs (age ${fixed.retireAge ?? '—'})</div></div>
<div class="m"><div class="ml">Simulation Median</div><div class="mv grn">${mc.yearsToRetire ?? 'N/A'} yrs (age ${mc.retireAge ?? '—'})</div></div>
<div class="m"><div class="ml">MC Success</div><div class="mv">${mc.successRate}%</div></div>
</div>
<h2>Financial Overview</h2>
<table><tr><th>Param</th><th>Value</th><th>Param</th><th>Value</th></tr>
<tr><td>Age</td><td>${inp.age}</td><td>Investments</td><td>${fmtFull(inp.investments)}</td></tr>
<tr><td>Income</td><td>${fmtFull(inp.income)}</td><td>Spending</td><td>${fmtFull(inp.spending)}</td></tr>
<tr><td>Savings Rate</td><td>${sr}%</td><td>Annual Savings</td><td>${fmtFull(savings)}</td></tr>
<tr><td>Retirement Spending</td><td>${fmtFull(inp.retirementSpending)}</td><td>Withdrawal Rate</td><td>${inp.withdrawalRate}%</td></tr></table>
<h2>Portfolio (Blended Return: ${blend}%)</h2>
<table><tr><th>Asset</th><th>Allocation</th><th>Return</th></tr>
<tr><td>Stocks</td><td>${inp.stockPct}%</td><td>${inp.stockReturn}%</td></tr>
<tr><td>Bonds</td><td>${inp.bondPct}%</td><td>${inp.bondReturn}%</td></tr>
<tr><td>Cash</td><td>${inp.cashPct}%</td><td>0.1%</td></tr></table>
<h2>Simulation (${mc.numSims} Trials)</h2>
<table><tr><th>Metric</th><th>Value</th></tr>
<tr><td>Success Rate</td><td>${mc.successRate}%</td></tr>
<tr><td>Median Retirement Age</td><td>${mc.retireAge ?? 'N/A'}</td></tr>
<tr><td>10th / 90th %ile</td><td>Age ${mc.p10 ?? '—'} / ${mc.p90 ?? '—'}</td></tr>
<tr><td>Median Final Portfolio</td><td>${fmtFull(mc.medianFinal)}</td></tr></table>
<h2>Milestones</h2>
<table><tr><th>Age</th><th>Portfolio</th><th>% of Target</th></tr>
${fixed.data.filter((_, i) => i % 5 === 0).map(d => `<tr><td>${d.age}</td><td>${fmtFull(d.saved)}</td><td>${((d.saved / fixed.fireTarget) * 100).toFixed(1)}%</td></tr>`).join('')}</table>
<div class="n"><strong>Disclaimer:</strong> For planning purposes only. The simulation assumes normally distributed returns (stocks: μ=${inp.stockReturn}%, σ=17.5%; bonds: μ=${inp.bondReturn}%, σ=6%). Not financial advice.</div>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

/* ════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════ */
export default function RetireWhenCalculator() {
  const [inp, setInp] = useState({
    age: 32, investments: 25000, income: 60000, spending: 45000,
    incomeGrowth: 1, extraIncome: 0, extraExpense: 0,
    extraIncStart: 50, extraIncEnd: 70, extraExpStart: 50, extraExpEnd: 70,
    stockPct: 80, bondPct: 18, cashPct: 2,
    stockReturn: 8.1, bondReturn: 2.4,
    retirementSpending: 40000, withdrawalRate: 4, taxRate: 7,
  });
  const [tab, setTab] = useState("fixed");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [mcSeed, setMcSeed] = useState(0);

  useEffect(() => {
    try {
      const r = localStorage.getItem("preRetirement-v1");
      if (r) {
        const p = JSON.parse(r);
        setInp(p.inp || p);
        if (p.tab) setTab(p.tab);
      }
    } catch {}
    setReady(true);
  }, []);

  const saveAll = useCallback(() => {
    try {
      localStorage.setItem("preRetirement-v1", JSON.stringify({ inp, tab }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {}
  }, [inp, tab]);

  const upd = (k, v) => setInp(prev => {
    const n = { ...prev, [k]: v };
    if (k === "stockPct") { n.bondPct = Math.max(0, Math.min(100 - v, prev.bondPct)); n.cashPct = 100 - v - n.bondPct; }
    if (k === "bondPct") { n.stockPct = Math.max(0, Math.min(100 - v, prev.stockPct)); n.cashPct = 100 - v - n.stockPct; }
    return n;
  });

  const savings = inp.income - inp.spending;
  const savingsRate = inp.income > 0 ? (savings / inp.income) * 100 : 0;
  const fireTarget = inp.retirementSpending / (inp.withdrawalRate / 100);

  const fixed = useMemo(() => computeFixed(inp), [inp]);
  const hist = useMemo(() => computeHistorical(inp), [inp]);
  const mc = useMemo(() => computeMC(inp, 500), [inp, mcSeed]);
  const sens = useMemo(() => computeSensitivity(inp), [inp]);
  const srSens = useMemo(() => computeSRSensitivity(inp), [inp]);

  if (!ready) return <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: MONO, fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: FONT, color: C.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:0.3}input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}`}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.white} 0%, #F8FAFC 100%)`, borderBottom: `1px solid ${C.border}`, padding: "26px 28px 22px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 18 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 999, background: C.white, color: C.textSecondary, fontSize: 11, fontFamily: MONO, fontWeight: 600, marginBottom: 10 }}>
              Retirement Timing Calculator
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: C.text, letterSpacing: "-0.055em", margin: 0, lineHeight: 1.05 }}>Retire When?</h1>
            <p style={{ color: C.textSecondary, fontSize: 14, margin: "8px 0 0", maxWidth: 620, lineHeight: 1.55 }}>
              Estimate when your savings may support retirement using current assets, spending, portfolio mix, and market assumptions.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={saveAll} style={{ background: saved ? C.accentLight : C.white, color: saved ? C.accent : C.textSecondary, border: `1px solid ${saved ? C.accent : C.border}`, borderRadius: 999, padding: "8px 16px", fontSize: 12, fontFamily: FONT, fontWeight: 700, cursor: "pointer" }}>
              {saved ? "✓ Saved" : "Save Inputs"}
            </button>
            <button onClick={() => exportPDF(inp, fixed, mc)} style={{ background: C.text, color: "#fff", border: "none", borderRadius: 999, padding: "9px 17px", fontSize: 12, fontFamily: FONT, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(15,23,42,0.14)" }}>
              Export Summary
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "22px 28px" }}>

        {/* Metrics */}
        <Card style={{ display: "flex", flexWrap: "wrap", marginBottom: 14, overflow: "hidden" }}>
          <Metric label="Estimated Retirement Age" value={fixed.retireAge ? `Age ${fixed.retireAge}` : "40+"} sub="Base case projection" color={C.accent} />
          <Metric label="Years Until Retirement" value={fixed.yearsToRetire ?? "—"} sub={`From current age ${inp.age}`} color={C.text} />
          <Metric label="Retirement Target" value={fmt(fireTarget)} sub={`${inp.withdrawalRate}% withdrawal rate`} color={C.fire} />
          <Metric label="Simulation Success" value={`${mc.successRate}%`} sub={`${mc.numSims} simulated paths`} color={C.blue} />
        </Card>

        {/* Main Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "310px 1fr", gap: 14, alignItems: "start" }}>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>Personal Inputs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input label="Current Age" value={inp.age} onChange={v => upd("age", v)} />
                  <Input label="Invested Assets" value={inp.investments} onChange={v => upd("investments", v)} prefix="$" />
                </div>
                <Input label="Annual Income" value={inp.income} onChange={v => upd("income", v)} prefix="$" />
                <Input label="Annual Spending" value={inp.spending} onChange={v => upd("spending", v)} prefix="$" />
                <Input label="Pre-retirement Income Growth" value={inp.incomeGrowth} onChange={v => upd("incomeGrowth", v)} suffix="%" step={0.5} />
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>Retirement Assumptions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <Input label="Retirement Spending" value={inp.retirementSpending} onChange={v => upd("retirementSpending", v)} prefix="$" />
                <Input label="Withdrawal Rate" value={inp.withdrawalRate} onChange={v => upd("withdrawalRate", v)} suffix="%" step={0.25} />
                <div style={{ background: C.blueLight, border: `1px solid ${C.borderLight}`, borderRadius: 10, padding: "10px 12px", color: C.textSecondary, fontSize: 11.5, lineHeight: 1.5 }}>
                  Retirement spending can differ from current annual spending and drives the retirement target.
                </div>
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, marginBottom: 12 }}>Portfolio Assumptions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Input label="Stock %" value={inp.stockPct} onChange={v => upd("stockPct", v)} suffix="%" />
                  <Input label="Bond %" value={inp.bondPct} onChange={v => upd("bondPct", v)} suffix="%" />
                  <Input label="Cash %" value={inp.cashPct} onChange={v => upd("cashPct", v)} suffix="%" />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Input label="Stock Return" value={inp.stockReturn} onChange={v => upd("stockReturn", v)} suffix="%" step={0.1} />
                  <Input label="Bond Return" value={inp.bondReturn} onChange={v => upd("bondReturn", v)} suffix="%" step={0.1} />
                </div>
                <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${inp.stockPct}%`, background: C.accent, transition: "width 0.3s" }} />
                  <div style={{ width: `${inp.bondPct}%`, background: C.blue, transition: "width 0.3s" }} />
                  <div style={{ width: `${inp.cashPct}%`, background: C.textTertiary, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontFamily: MONO, color: C.textTertiary }}>
                  <span><span style={{ color: C.accent }}>●</span> Stocks</span>
                  <span><span style={{ color: C.blue }}>●</span> Bonds</span>
                  <span><span style={{ color: C.textTertiary }}>●</span> Cash</span>
                </div>
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <button onClick={() => setShowExtra(!showExtra)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "100%", fontSize: 10, fontFamily: MONO, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, padding: 0 }}>
                <span style={{ transform: showExtra ? "rotate(90deg)" : "rotate(0)", transition: "0.2s", display: "inline-block" }}>▸</span> Extra Income / Expenses
              </button>
              {showExtra && (
                <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
                  <Input label="Extra Income" value={inp.extraIncome} onChange={v => upd("extraIncome", v)} prefix="$" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input label="Start Age" value={inp.extraIncStart} onChange={v => upd("extraIncStart", v)} />
                    <Input label="End Age" value={inp.extraIncEnd} onChange={v => upd("extraIncEnd", v)} />
                  </div>
                  <Input label="Extra Expense" value={inp.extraExpense} onChange={v => upd("extraExpense", v)} prefix="$" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input label="Start Age" value={inp.extraExpStart} onChange={v => upd("extraExpStart", v)} />
                    <Input label="End Age" value={inp.extraExpEnd} onChange={v => upd("extraExpEnd", v)} />
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Charts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Tab active={tab === "fixed"} onClick={() => setTab("fixed")}>Base Case</Tab>
              <Tab active={tab === "historical"} onClick={() => setTab("historical")}>Historical Scenarios</Tab>
              <Tab active={tab === "montecarlo"} onClick={() => setTab("montecarlo")}>Simulation</Tab>
              <Tab active={tab === "breakdown"} onClick={() => setTab("breakdown")}>Plan Breakdown</Tab>
            </div>

            {/* ═══ FIXED ═══ */}
            {tab === "fixed" && (
              <Card>
                <Header right={fixed.retireAge && <span style={{ fontSize: 11.5, fontFamily: MONO, color: C.accent, fontWeight: 600, background: C.accentLight, padding: "3px 10px", borderRadius: 4 }}>Estimated age {fixed.retireAge}</span>}>Base Case Projection</Header>
                <div style={{ padding: "6px 10px 2px" }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={fixed.data} margin={{ top: 10, right: 14, left: 6, bottom: 5 }}>
                      <defs>
                        <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.18} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.02} /></linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.12} /><stop offset="100%" stopColor={C.blue} stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                      <XAxis dataKey="age" stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickLine={false} />
                      <YAxis stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickFormatter={fmt} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="saved" name="Total Portfolio" fill="url(#gS)" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 2.5, strokeWidth: 0 }} activeDot={{ r: 6, fill: C.accent, stroke: C.white, strokeWidth: 2 }} />
                      <Area type="monotone" dataKey="contributions" name="Contributions" fill="url(#gC)" stroke={C.blue} strokeWidth={1.5} strokeDasharray="4 3" dot={false} activeDot={{ r: 4, fill: C.blue, stroke: C.white, strokeWidth: 2 }} />
                      <ReferenceLine y={fireTarget} stroke={C.fire} strokeWidth={2} strokeDasharray="8 5" label={{ value: `Target ${fmt(fireTarget)}`, position: "insideTopLeft", fill: C.fire, fontSize: 11, fontFamily: MONO, fontWeight: 600 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ padding: "4px 18px 12px", fontSize: 10.5, fontFamily: MONO, color: C.textTertiary, display: "flex", gap: 18 }}>
                  <span><span style={{ color: C.accent }}>━</span> Portfolio</span>
                  <span><span style={{ color: C.blue }}>╌</span> Contributions</span>
                  <span><span style={{ color: C.fire }}>┅</span> Retirement Target</span>
                  <span style={{ marginLeft: "auto" }}>Blended: {((inp.stockPct / 100) * inp.stockReturn + (inp.bondPct / 100) * inp.bondReturn).toFixed(2)}%</span>
                </div>
              </Card>
            )}

            {/* ═══ HISTORICAL ═══ */}
            {tab === "historical" && (
              <Card>
                <Header right={<span style={{ fontSize: 11, fontFamily: MONO, color: C.textTertiary }}>{hist.totalCycles} cycles (1872–2024) · {hist.successRate}% success</span>}>Historical Scenario Analysis</Header>
                <div style={{ padding: "6px 10px 2px" }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={hist.data} margin={{ top: 10, right: 14, left: 6, bottom: 5 }}>
                      <defs>
                        <linearGradient id="hW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.1} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.02} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                      <XAxis dataKey="age" stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickLine={false} />
                      <YAxis stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickFormatter={fmt} tickLine={false} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="p95" name="95th" fill="none" stroke={C.accent} strokeWidth={0.5} strokeOpacity={0.3} />
                      <Area type="monotone" dataKey="p75" name="75th" fill="url(#hW)" stroke={C.accent} strokeWidth={0.7} strokeOpacity={0.4} />
                      <Area type="monotone" dataKey="p25" name="25th" fill={C.fireLight} stroke={C.fire} strokeWidth={0.7} strokeOpacity={0.4} />
                      <Area type="monotone" dataKey="p5" name="5th" fill={C.bg} stroke={C.red} strokeWidth={0.5} strokeOpacity={0.3} />
                      <Line type="monotone" dataKey="median" name="Median" stroke={C.text} strokeWidth={2.5} dot={false} />
                      <ReferenceLine y={fireTarget} stroke={C.fire} strokeWidth={2} strokeDasharray="8 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ padding: "6px 18px 12px", display: "flex", gap: 18, fontSize: 10.5, fontFamily: MONO, color: C.textTertiary }}>
                  {hist.p10 && <span>Best 10%: <b style={{ color: C.accent }}>age {hist.p10}</b></span>}
                  {hist.retireAge && <span>Median: <b style={{ color: C.text }}>age {hist.retireAge}</b></span>}
                  {hist.p90 && <span>Worst 10%: <b style={{ color: C.fire }}>age {hist.p90}</b></span>}
                </div>
              </Card>
            )}

            {/* ═══ MONTE CARLO ═══ */}
            {tab === "montecarlo" && (
              <>
                <Card>
                  <Header right={
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, fontFamily: MONO, color: C.textTertiary }}>{mc.numSims} sims · {mc.successRate}% success</span>
                      <button onClick={() => setMcSeed(s => s + 1)} style={{ background: C.accentLight, color: C.accent, border: `1px solid ${C.accent}30`, borderRadius: 5, padding: "3px 11px", fontSize: 11, fontFamily: MONO, fontWeight: 600, cursor: "pointer" }}>Re-run ↻</button>
                    </div>
                  }>Retirement Timing Simulation</Header>
                  <div style={{ padding: "6px 10px 2px" }}>
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={mc.data} margin={{ top: 10, right: 14, left: 6, bottom: 5 }}>
                        <defs>
                          <linearGradient id="mW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.purple} stopOpacity={0.07} /><stop offset="100%" stopColor={C.purple} stopOpacity={0.01} /></linearGradient>
                          <linearGradient id="mM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.1} /><stop offset="100%" stopColor={C.blue} stopOpacity={0.02} /></linearGradient>
                          <linearGradient id="mN" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.15} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.03} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                        <XAxis dataKey="age" stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickLine={false} />
                        <YAxis stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickFormatter={fmt} tickLine={false} />
                        <Tooltip content={<ChartTip />} />
                        <Area type="monotone" dataKey="p95" name="95th" fill="url(#mW)" stroke={C.purple} strokeWidth={0.5} strokeOpacity={0.3} />
                        <Area type="monotone" dataKey="p75" name="75th" fill="url(#mM)" stroke={C.blue} strokeWidth={0.7} strokeOpacity={0.4} />
                        <Area type="monotone" dataKey="p25" name="25th" fill="url(#mN)" stroke={C.accent} strokeWidth={0.7} strokeOpacity={0.4} />
                        <Area type="monotone" dataKey="p5" name="5th" fill={C.bg} stroke={C.red} strokeWidth={0.5} strokeOpacity={0.3} />
                        <Line type="monotone" dataKey="median" name="Median" stroke={C.text} strokeWidth={2.5} dot={false} />
                        <ReferenceLine y={fireTarget} stroke={C.fire} strokeWidth={2} strokeDasharray="8 5" label={{ value: `Target ${fmt(fireTarget)}`, position: "insideTopLeft", fill: C.fire, fontSize: 11, fontFamily: MONO, fontWeight: 600 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ padding: "6px 18px 12px", display: "flex", gap: 18, fontSize: 10.5, fontFamily: MONO, color: C.textTertiary, flexWrap: "wrap" }}>
                    {mc.p10 && <span>Best 10%: <b style={{ color: C.purple }}>age {mc.p10}</b></span>}
                    {mc.retireAge && <span>Median: <b style={{ color: C.text }}>age {mc.retireAge}</b></span>}
                    {mc.p90 && <span>Worst 10%: <b style={{ color: C.fire }}>age {mc.p90}</b></span>}
                    <span>Median final: <b style={{ color: C.blue }}>{fmt(mc.medianFinal)}</b></span>
                  </div>
                </Card>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {mc.retireHist.length > 0 && (
                    <Card>
                      <Header>Retirement Age Distribution</Header>
                      <div style={{ padding: "6px 10px 2px" }}>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={mc.retireHist} margin={{ top: 8, right: 14, left: 4, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                            <XAxis dataKey="age" stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} />
                            <YAxis stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} />
                            <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: MONO, fontSize: 11, boxShadow: C.shadowMd }} />
                            <Bar dataKey="count" name="Sims" radius={[3, 3, 0, 0]}>
                              {mc.retireHist.map((d, i) => <Cell key={i} fill={d.age === mc.retireAge ? C.accent : `${C.accent}40`} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  )}
                  <Card>
                    <Header>Final Portfolio Distribution</Header>
                    <div style={{ padding: "6px 10px 2px" }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={mc.histogram} margin={{ top: 8, right: 14, left: 4, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                          <XAxis dataKey="range" stroke={C.textTertiary} fontSize={9} fontFamily={MONO} tickLine={false} interval={3} />
                          <YAxis stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} />
                          <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: MONO, fontSize: 11, boxShadow: C.shadowMd }} formatter={v => [`${v} sims`, "Count"]} />
                          <Bar dataKey="count" name="Sims" fill={C.blue} radius={[3, 3, 0, 0]} fillOpacity={0.65} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
              </>
            )}

            {/* ═══ SENSITIVITY (always visible below projections) ═══ */}
            {tab !== "breakdown" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Card>
                  <Header>Spending vs. Years to Retire</Header>
                  <div style={{ padding: "6px 10px 2px" }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={sens} margin={{ top: 8, right: 14, left: 4, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                        <XAxis dataKey="spending" stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <YAxis stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} label={{ value: "Years", angle: -90, position: "insideLeft", fill: C.textTertiary, fontSize: 10, fontFamily: MONO }} />
                        <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: MONO, fontSize: 11, boxShadow: C.shadowMd }} formatter={v => [`${v.toFixed(1)} yrs`, "Years"]} labelFormatter={v => fmtFull(v)} />
                        <Line type="monotone" dataKey="years" stroke={C.fire} strokeWidth={2.5} dot={{ fill: C.fire, r: 4, stroke: C.white, strokeWidth: 2 }} />
                        <ReferenceLine x={inp.spending} stroke={C.accent} strokeWidth={1.5} strokeDasharray="5 3" label={{ value: "You", position: "top", fill: C.accent, fontSize: 10, fontFamily: MONO, fontWeight: 600 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <Header>Savings Rate vs. Years to Retire</Header>
                  <div style={{ padding: "6px 10px 2px" }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={srSens} margin={{ top: 8, right: 14, left: 4, bottom: 5 }}>
                        <defs>
                          <linearGradient id="srG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.12} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                        <XAxis dataKey="rate" stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} tickFormatter={v => `${v}%`} />
                        <YAxis stroke={C.textTertiary} fontSize={10} fontFamily={MONO} tickLine={false} label={{ value: "Years", angle: -90, position: "insideLeft", fill: C.textTertiary, fontSize: 10, fontFamily: MONO }} />
                        <Tooltip contentStyle={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: MONO, fontSize: 11, boxShadow: C.shadowMd }} formatter={v => [`${v.toFixed(1)} yrs`, "Years"]} labelFormatter={v => `${v}% savings rate`} />
                        <Area type="monotone" dataKey="years" fill="url(#srG)" stroke={C.accent} strokeWidth={2.5} dot={{ fill: C.accent, r: 4, stroke: C.white, strokeWidth: 2 }} />
                        <ReferenceLine x={Math.round(savingsRate / 5) * 5} stroke={C.fire} strokeWidth={1.5} strokeDasharray="5 3" label={{ value: "You", position: "top", fill: C.fire, fontSize: 10, fontFamily: MONO, fontWeight: 600 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            )}

            {/* ═══ BREAKDOWN ═══ */}
            {tab === "breakdown" && (
              <>
                <Card>
                  <Header>Contributions vs. Investment Returns</Header>
                  <div style={{ padding: "6px 10px 2px" }}>
                    <ResponsiveContainer width="100%" height={360}>
                      <AreaChart data={fixed.data} margin={{ top: 10, right: 14, left: 6, bottom: 5 }}>
                        <defs>
                          <linearGradient id="bC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.blue} stopOpacity={0.25} /><stop offset="100%" stopColor={C.blue} stopOpacity={0.04} /></linearGradient>
                          <linearGradient id="bR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity={0.25} /><stop offset="100%" stopColor={C.accent} stopOpacity={0.04} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                        <XAxis dataKey="age" stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickLine={false} />
                        <YAxis stroke={C.textTertiary} fontSize={11} fontFamily={MONO} tickFormatter={fmt} tickLine={false} />
                        <Tooltip content={<ChartTip />} />
                        <Area type="monotone" dataKey="contributions" name="Contributions" stackId="1" fill="url(#bC)" stroke={C.blue} strokeWidth={1.5} />
                        <Area type="monotone" dataKey="returns" name="Returns" stackId="1" fill="url(#bR)" stroke={C.accent} strokeWidth={1.5} />
                        <ReferenceLine y={fireTarget} stroke={C.fire} strokeWidth={1.5} strokeDasharray="8 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ padding: "4px 18px 12px", fontSize: 10.5, fontFamily: MONO, color: C.textTertiary, display: "flex", gap: 18 }}>
                    <span><span style={{ color: C.blue }}>■</span> Contributions</span>
                    <span><span style={{ color: C.accent }}>■</span> Returns</span>
                  </div>
                </Card>

                <Card>
                  <Header>Milestones</Header>
                  <div style={{ overflowX: "auto", padding: "0 2px 6px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                          {["Age", "Portfolio", "Contributions", "Returns", "% of Target"].map(h => (
                            <th key={h} style={{ padding: "9px 14px", textAlign: h === "Age" ? "left" : "right", fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textTertiary, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fixed.data.filter((_, i) => i % 5 === 0).map((d, i) => {
                          const pf = (d.saved / fireTarget) * 100;
                          return (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: d.age === fixed.retireAge ? C.accentLight : "transparent" }}>
                              <td style={{ padding: "7px 14px", fontWeight: d.age === fixed.retireAge ? 700 : 400, color: d.age === fixed.retireAge ? C.accent : C.text }}>{d.age}{d.age === fixed.retireAge ? " ✦" : ""}</td>
                              <td style={{ padding: "7px 14px", textAlign: "right", fontWeight: 500 }}>{fmtFull(d.saved)}</td>
                              <td style={{ padding: "7px 14px", textAlign: "right", color: C.blue }}>{fmtFull(d.contributions)}</td>
                              <td style={{ padding: "7px 14px", textAlign: "right", color: C.accent }}>{fmtFull(d.returns)}</td>
                              <td style={{ padding: "7px 14px", textAlign: "right" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                  <div style={{ width: 55, height: 4, background: C.borderLight, borderRadius: 2, overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(100, pf)}%`, height: "100%", background: pf >= 100 ? C.accent : C.fire, borderRadius: 2 }} />
                                  </div>
                                  <span style={{ fontWeight: 500, color: pf >= 100 ? C.accent : C.text, minWidth: 38 }}>{pf.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}

            <div style={{ fontSize: 10.5, color: C.textTertiary, lineHeight: 1.6, padding: "2px 0" }}>
              <strong style={{ color: C.textSecondary }}>Disclaimer:</strong> For planning purposes only. Historical cycles use 153 years of S&P Composite / S&P 500 returns and 10-year Treasury bond returns from Prof. Robert Shiller's dataset (shillerdata.com, 1872–2024). The simulation assumes normally distributed returns (stocks: μ={inp.stockReturn}%, σ=17.5%; bonds: μ={inp.bondReturn}%, σ=6%). Not financial advice.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
