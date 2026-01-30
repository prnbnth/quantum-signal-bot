document.addEventListener("DOMContentLoaded", () => {

  /* ===== TIME ===== */
  const timeBox = document.getElementById("time");
  setInterval(() => {
    timeBox.textContent =
      new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  }, 1000);

  const scannerBox = document.getElementById("scanner");
  const signalBox = document.getElementById("signalBox");
  const assetSelect = document.getElementById("assetSelect");

  /* ===== MODE STATE ===== */
  let mode = "CRYPTO"; // CRYPTO or FOREX
  let marketActive = false;

  /* ===== SIGNAL DISPLAY ===== */
  function setSignal(type) {
    signalBox.style.color = "#aaa";
    if (type === "up") {
      signalBox.textContent = "UP";
      signalBox.style.color = "#00ff9c";
    } else if (type === "down") {
      signalBox.textContent = "DOWN";
      signalBox.style.color = "#ff6a6a";
    } else {
      signalBox.textContent = "NO SIGNAL";
    }
  }

  /* ===== ASSETS ===== */
  const ASSETS = {
    BTC: { symbol: "btcusdt", class: "btc", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg", type: "CRYPTO" },
    ETH: { symbol: "ethusdt", class: "eth", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg", type: "CRYPTO" },
    XRP: { symbol: "xrpusdt", class: "xrp", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg", type: "CRYPTO" },
    SOL: { symbol: "solusdt", class: "sol", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg", type: "CRYPTO" },

    "EUR/USD": { type: "FOREX" },
    "GBP/USD": { type: "FOREX" },
    "USD/JPY": { type: "FOREX" },
    "XAU/USD": { type: "FOREX" }
  };

  let scannerData = {};
  let tradeData = [];
  let tradeSocket = null;

  /* ===== HELPERS ===== */
  function isActive(candles) {
    if (candles.length < 10) return false;
    const bodies = candles.map(c => Math.abs(c.close - c.open));
    const last = bodies.at(-1);
    const avg = bodies.slice(-10).reduce((a,b)=>a+b,0) / 10;
    return last >= avg * 1.05;
  }

  function vwap(candles) {
    let sum = 0;
    candles.forEach(c => {
      sum += (c.high + c.low + c.close) / 3;
    });
    return sum / candles.length;
  }

  /* ===== CRYPTO SCANNER ===== */
  function renderScanner() {
    scannerBox.innerHTML = "";
    Object.keys(scannerData).forEach(k => {
      const active = isActive(scannerData[k]);
      const div = document.createElement("div");
      div.className = `scanner-item ${ASSETS[k].class} ${active ? "active" : "quiet"}`;
      div.innerHTML = `
        <img src="${ASSETS[k].logo}">
        <div>${k}<br>${active ? "🔥 ACTIVE" : "⚪ QUIET"}</div>
      `;
      scannerBox.appendChild(div);
    });
  }

  Object.keys(ASSETS).forEach(k => {
    if (ASSETS[k].type !== "CRYPTO") return;
    scannerData[k] = [];
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ASSETS[k].symbol}@kline_1m`);
    ws.onmessage = e => {
      const d = JSON.parse(e.data).k;
      if (!d.x) return;
      scannerData[k].push({
        open:+d.o, close:+d.c, high:+d.h, low:+d.l
      });
      if (scannerData[k].length > 30) scannerData[k].shift();
      renderScanner();
    };
  });

  /* ===== TRADE ENGINE (CRYPTO + FOREX CONFIRMATION) ===== */
  function connectTrade(asset) {
    if (tradeSocket) tradeSocket.close();
    tradeData = [];
    setSignal("neutral");

    if (ASSETS[asset].type === "FOREX") {
      mode = "FOREX";
      return;
    }

    mode = "CRYPTO";
    tradeSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${ASSETS[asset].symbol}@kline_1m`);
    tradeSocket.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;

      tradeData.push({
        open:+k.o, close:+k.c, high:+k.h, low:+k.l
      });
      if (tradeData.length > 30) tradeData.shift();

      evaluateSignal();
    };
  }

  /* ===== SIGNAL LOGIC ===== */
  function evaluateSignal() {
    if (mode === "FOREX" && !marketActive) {
      setSignal("neutral");
      return;
    }

    if (tradeData.length < 10) {
      setSignal("neutral");
      return;
    }

    if (!isActive(tradeData)) {
      setSignal("neutral");
      return;
    }

    const last = tradeData.at(-1);
    const prev = tradeData.at(-2);
    const vw = vwap(tradeData.slice(-20));

    const body = Math.abs(last.close - last.open);
    const prevBody = Math.abs(prev.close - prev.open);
    const range = last.high - last.low;
    const closePos = (last.close - last.low) / range;

    if (
      last.close > vw &&
      closePos > 0.6 &&
      body > prevBody
    ) {
      setSignal("up");
    }
    else if (
      last.close < vw &&
      closePos < 0.4 &&
      body > prevBody
    ) {
      setSignal("down");
    }
    else {
      setSignal("neutral");
    }
  }

  /* ===== MANUAL FOREX CONTROL ===== */
  document.addEventListener("keydown", e => {
    if (mode !== "FOREX") return;
    if (e.key === "a") {
      marketActive = !marketActive;
      alert(`FOREX MARKET ACTIVE: ${marketActive ? "ON" : "OFF"}`);
    }
  });

  assetSelect.addEventListener("change", e => {
    connectTrade(e.target.value);
  });

  connectTrade("BTC");
});
