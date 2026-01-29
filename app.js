/***********************
 * IST CLOCK
 ***********************/
function updateTime() {
  document.getElementById("time").textContent =
    new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
}
setInterval(updateTime, 1000);
updateTime();

/***********************
 * UI
 ***********************/
const signalBox = document.getElementById("signalBox");
const scannerBox = document.getElementById("scanner");

function setSignal(state) {
  signalBox.className = `signal-box ${state}`;
  signalBox.textContent =
    state === "up" ? "UP" :
    state === "down" ? "DOWN" :
    "NO SIGNAL";
}

/***********************
 * ASSET MAP
 ***********************/
const ASSETS = {
  BTC: { type: "crypto", symbol: "btcusdt" },
  ETH: { type: "crypto", symbol: "ethusdt" },
  XRP: { type: "crypto", symbol: "xrpusdt" },
  SOL: { type: "crypto", symbol: "solusdt" },

  "EUR/USD": { type: "forex", tv: "FX:EURUSD" },
  "GBP/USD": { type: "forex", tv: "FX:GBPUSD" },
  "USD/JPY": { type: "forex", tv: "FX:USDJPY" },
  "EUR/JPY": { type: "forex", tv: "FX:EURJPY" },
  "GBP/JPY": { type: "forex", tv: "FX:GBPJPY" },
  "AUD/USD": { type: "forex", tv: "FX:AUDUSD" },
  "USD/CAD": { type: "forex", tv: "FX:USDCAD" },

  "XAU/USD": { type: "forex", tv: "OANDA:XAUUSD" },
  "XAG/USD": { type: "forex", tv: "OANDA:XAGUSD" }
};

/***********************
 * DATA STORAGE
 ***********************/
let candles = [];
let socket = null;
let scannerData = {};

/***********************
 * INDICATORS
 ***********************/
function EMA(v, p) {
  let k = 2 / (p + 1), e = v[0];
  for (let i = 1; i < v.length; i++) e = v[i] * k + e * (1 - k);
  return e;
}

function RSI(v, p = 7) {
  let g = 0, l = 0;
  for (let i = v.length - p; i < v.length - 1; i++) {
    let d = v[i + 1] - v[i];
    d >= 0 ? g += d : l -= d;
  }
  if (l === 0) return 100;
  return 100 - (100 / (1 + g / l));
}

function avgBody(c) {
  return c.slice(-10).reduce((s, x) =>
    s + Math.abs(x.close - x.open), 0) / 10;
}

/***********************
 * MOMENTUM SCORE
 ***********************/
function momentumScore(c) {
  if (c.length < 15) return 0;
  const close = c.map(x => x.close);
  const open = c.map(x => x.open);
  let score = 0;
  if (EMA(close.slice(-5), 5) > EMA(close.slice(-13), 13)) score++;
  if (RSI(close) > 55 || RSI(close) < 45) score++;
  if (Math.abs(close.at(-1) - open.at(-1)) > avgBody(c)) score++;
  return score;
}

/***********************
 * SCANNER DISPLAY
 ***********************/
function renderScanner() {
  let rows = [];
  for (let a in scannerData) {
    const s = momentumScore(scannerData[a]);
    rows.push(`${a}: ${s >= 2 ? "🔥 HOT" : "⚪ NEUTRAL"}`);
  }
  scannerBox.innerHTML = rows.join(" | ");
}

/***********************
 * CONNECT MARKET (TRADE VIEW)
 ***********************/
function connectMarket(assetKey) {
  if (socket) socket.close();
  candles = [];
  setSignal("neutral");

  const asset = ASSETS[assetKey];

  if (asset.type === "crypto") {
    socket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${asset.symbol}@kline_1m`
    );
    socket.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;
      candles.push({ open: +k.o, close: +k.c });
      if (candles.length > 50) candles.shift();
      evaluateSignal();
    };
  }
}

/***********************
 * SIGNAL ENGINE
 ***********************/
function evaluateSignal() {
  if (candles.length < 15) return setSignal("neutral");

  const c = candles.map(x => x.close);
  const o = candles.map(x => x.open);

  if (
    EMA(c.slice(-5), 5) > EMA(c.slice(-13), 13) &&
    RSI(c) > 55 &&
    Math.abs(c.at(-1) - o.at(-1)) > avgBody(candles)
  ) return setSignal("up");

  if (
    EMA(c.slice(-5), 5) < EMA(c.slice(-13), 13) &&
    RSI(c) < 45 &&
    Math.abs(c.at(-1) - o.at(-1)) > avgBody(candles)
  ) return setSignal("down");

  setSignal("neutral");
}

/***********************
 * INIT SCANNER (CRYPTO ONLY – REAL TIME)
 ***********************/
["BTC","ETH","XRP","SOL"].forEach(a => {
  scannerData[a] = [];
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${ASSETS[a].symbol}@kline_1m`
  );
  ws.onmessage = e => {
    const k = JSON.parse(e.data).k;
    if (!k.x) return;
    scannerData[a].push({ open:+k.o, close:+k.c });
    if (
