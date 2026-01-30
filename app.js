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

  function setSignal(type) {
    signalBox.className = "signal-box";
    if (type === "up") {
      signalBox.textContent = "UP";
      signalBox.style.color = "#00ff9c";
    } else if (type === "down") {
      signalBox.textContent = "DOWN";
      signalBox.style.color = "#ff6a6a";
    } else {
      signalBox.textContent = "NO SIGNAL";
      signalBox.style.color = "#aaa";
    }
  }

  /* ===== ASSETS ===== */
  const ASSETS = {
    BTC: { symbol: "btcusdt", class: "btc", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg" },
    ETH: { symbol: "ethusdt", class: "eth", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg" },
    XRP: { symbol: "xrpusdt", class: "xrp", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg" },
    SOL: { symbol: "solusdt", class: "sol", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg" }
  };

  let scannerData = {};
  let tradeData = [];
  let tradeSocket = null;

  /* ===== HELPERS ===== */
  function ema(values, period) {
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  function rsi(values, period = 7) {
    if (values.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = values.length - period; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 1);
    return 100 - (100 / (1 + rs));
  }

  function isActive(candles) {
    if (candles.length < 10) return false;
    const ranges = candles.map(c => Math.abs(c.close - c.open));
    const last = ranges.at(-1);
    const avg = ranges.slice(-10).reduce((a,b)=>a+b,0) / 10;
    return last > avg * 1.1;
  }

  /* ===== SCANNER ===== */
  function renderScanner() {
    scannerBox.innerHTML = "";
    Object.keys(scannerData).forEach(k => {
      const active = isActive(scannerData[k]);
      const div = document.createElement("div");
      div.className = `scanner-item ${ASSETS[k].class} ${active ? "active" : "quiet"}`;
      div.innerHTML = `
        <img src="${ASSETS[k].logo}">
        <div class="scanner-text">
          ${k}<br>${active ? "🔥 ACTIVE" : "⚪ QUIET"}
        </div>
      `;
      scannerBox.appendChild(div);
    });
  }

  Object.keys(ASSETS).forEach(k => {
    scannerData[k] = [];
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ASSETS[k].symbol}@kline_1m`);
    ws.onmessage = e => {
      const d = JSON.parse(e.data).k;
      if (!d.x) return;
      scannerData[k].push({ open:+d.o, close:+d.c });
      if (scannerData[k].length > 30) scannerData[k].shift();
      renderScanner();
    };
  });

  /* ===== TRADE ENGINE ===== */
  function connectTrade(asset) {
    if (tradeSocket) tradeSocket.close();
    tradeData = [];
    setSignal("neutral");

    tradeSocket = new WebSocket(`wss://stream.binance.com:9443/ws/${ASSETS[asset].symbol}@kline_1m`);
    tradeSocket.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;

      tradeData.push({ open:+k.o, close:+k.c });
      if (tradeData.length > 30) tradeData.shift();

      if (!isActive(tradeData)) {
        setSignal("neutral");
        return;
      }

      const closes = tradeData.map(c => c.close);
      const emaFastNow = ema(closes.slice(-5), 5);
      const emaFastPrev = ema(closes.slice(-6, -1), 5);
      const r = rsi(closes);

      if (emaFastNow > emaFastPrev && r > 50) {
        setSignal("up");
      } else if (emaFastNow < emaFastPrev && r < 50) {
        setSignal("down");
      } else {
        setSignal("neutral");
      }
    };
  }

  assetSelect.addEventListener("change", e => {
    connectTrade(e.target.value);
  });

  connectTrade("BTC");
});
