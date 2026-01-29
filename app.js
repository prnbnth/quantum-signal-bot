document.addEventListener("DOMContentLoaded", () => {

  /* =======================
     IST CLOCK
  ======================= */
  const timeBox = document.getElementById("time");
  function updateTime() {
    timeBox.textContent =
      new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  }
  setInterval(updateTime, 1000);
  updateTime();

  /* =======================
     UI REFERENCES
  ======================= */
  const signalBox = document.getElementById("signalBox");
  const scannerBox = document.getElementById("scanner");
  const assetSelect = document.getElementById("assetSelect");

  function setSignal(state) {
    signalBox.className = `signal-box ${state}`;
    signalBox.textContent =
      state === "up" ? "UP" :
      state === "down" ? "DOWN" :
      "NO SIGNAL";
  }

  /* =======================
     CRYPTO ASSETS (REAL TIME)
  ======================= */
  const CRYPTO_ASSETS = {
    BTC: "btcusdt",
    ETH: "ethusdt",
    XRP: "xrpusdt",
    SOL: "solusdt"
  };

  let tradeSocket = null;
  let tradeCandles = [];
  let scannerData = {};

  /* =======================
     INDICATORS
  ======================= */
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

  /* =======================
     MOMENTUM SCORE
  ======================= */
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

  /* =======================
     RENDER SCANNER CARDS
  ======================= */
  function renderScanner() {
    scannerBox.innerHTML = "";

    Object.keys(scannerData).forEach(asset => {
      const score = momentumScore(scannerData[asset]);
      const state = score >= 2 ? "hot" : "neutral";

      const card = document.createElement("div");
      card.className = `scanner-item ${state}`;
      card.innerHTML = `
        ${asset}<br>
        ${state === "hot" ? "🔥 HOT" : "⚪ NEUTRAL"}
      `;

      scannerBox.appendChild(card);
    });

    if (!scannerBox.children.length) {
      scannerBox.textContent = "Waiting for market data…";
    }
  }

  /* =======================
     INIT SCANNER SOCKETS
  ======================= */
  Object.keys(CRYPTO_ASSETS).forEach(asset => {
    scannerData[asset] = [];

    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${CRYPTO_ASSETS[asset]}@kline_1m`
    );

    ws.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;

      scannerData[asset].push({
        open: +k.o,
        close: +k.c
      });

      if (scannerData[asset].length > 50)
        scannerData[asset].shift();

      renderScanner();
    };
  });

  /* =======================
     TRADE CONNECTION
  ======================= */
  function connectMarket(asset) {
    if (!CRYPTO_ASSETS[asset]) {
      setSignal("neutral");
      return;
    }

    if (tradeSocket) tradeSocket.close();
    tradeCandles = [];
    setSignal("neutral");

    tradeSocket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${CRYPTO_ASSETS[asset]}@kline_1m`
    );

    tradeSocket.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;

      tradeCandles.push({
        open: +k.o,
        close: +k.c
      });

      if (tradeCandles.length > 50)
        tradeCandles.shift();

      evaluateSignal();
    };
  }

  /* =======================
     SIGNAL ENGINE
  ======================= */
  function evaluateSignal() {
    if (tradeCandles.length < 15) return setSignal("neutral");

    const c = tradeCandles.map(x => x.close);
    const o = tradeCandles.map(x => x.open);

    if (
      EMA(c.slice(-5), 5) > EMA(c.slice(-13), 13) &&
      RSI(c) > 55 &&
      Math.abs(c.at(-1) - o.at(-1)) > avgBody(tradeCandles)
    ) return setSignal("up");

    if (
      EMA(c.slice(-5), 5) < EMA(c.slice(-13), 13) &&
      RSI(c) < 45 &&
      Math.abs(c.at(-1) - o.at(-1)) > avgBody(tradeCandles)
    ) return setSignal("down");

    setSignal("neutral");
  }

  assetSelect.addEventListener("change", e => {
    connectMarket(e.target.value);
  });

  connectMarket("BTC");
});
