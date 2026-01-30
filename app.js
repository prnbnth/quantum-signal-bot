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

  /* ===== STATE ===== */
  let mode = "CRYPTO"; // CRYPTO | FOREX
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

  /* ===== ASSETS (SINGLE SOURCE OF TRUTH) ===== */
  const ASSETS = {
    BTC: { label: "BTC", symbol: "btcusdt", type: "CRYPTO", class: "btc", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg" },
    ETH: { label: "ETH", symbol: "ethusdt", type: "CRYPTO", class: "eth", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg" },
    XRP: { label: "XRP", symbol: "xrpusdt", type: "CRYPTO", class: "xrp", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg" },
    SOL: { label: "SOL", symbol: "solusdt", type: "CRYPTO", class: "sol", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg" },

    EURUSD: { label: "EUR/USD", type: "FOREX" },
    GBPUSD: { label: "GBP/USD", type: "FOREX" },
    USDJPY: { label: "USD/JPY", type: "FOREX" },
    XAUUSD: { label: "XAU/USD", type: "FOREX" }
  };

  /* ===== POPULATE ASSET DROPDOWN (FIX) ===== */
  function populateAssets() {
    assetSelect.innerHTML = "";

    const cryptoGroup = document.createElement("optgroup");
    cryptoGroup.label = "CRYPTO";

    const forexGroup = document.createElement("optgroup");
    forexGroup.label = "FOREX / OTC";

    Object.keys(ASSETS).forEach(key => {
      const asset = ASSETS[key];
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = asset.label;

      if (asset.type === "CRYPTO") {
        cryptoGroup.appendChild(opt);
      } else {
        forexGroup.appendChild(opt);
      }
    });

    assetSelect.appendChild(cryptoGroup);
    assetSelect.appendChild(forexGroup);
  }

  populateAssets();

  /* ===== DATA ===== */
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
      const asset = ASSETS[k];
      const active = isActive(scannerData[k]);
      const div = document.createElement("div");
      div.className = `scanner-item ${asset.class} ${active ? "active" : "quiet"}`;
      div.innerHTML = `
        <img src="${asset.logo}">
        <div>${asset.label}<br>${active ? "🔥 ACTIVE" : "⚪ QUIET"}</div>
      `;
      scannerBox.appendChild(div);
    });
  }

  /* ===== INIT CRYPTO SCANNER ===== */
  Object.keys(ASSETS).forEach(k => {
    if (ASSETS[k].type !== "CRYPTO") return;
    scannerData[k] = [];
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${ASSETS[k].symbol}@kline_1m`
    );
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

  /* ===== TRADE ENGINE ===== */
  function connectTrade(assetKey) {
    if (tradeSocket) tradeSocket.close();
    tradeData = [];
    setSignal("neutral");

    const asset = ASSETS[assetKey];

    if (asset.type === "FOREX") {
      mode = "FOREX";
      alert("FOREX MODE ENABLED\nPress A to toggle Market Active");
      return;
    }

    mode = "CRYPTO";
    tradeSocket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${asset.symbol}@kline_1m`
    );
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

    if (last.close > vw && closePos > 0.6 && body > prevBody) {
      setSignal("up");
    } else if (last.close < vw && closePos < 0.4 && body > prevBody) {
      setSignal("down");
    } else {
      setSignal("neutral");
    }
  }

  /* ===== FOREX MANUAL CONTROL ===== */
  document.addEventListener("keydown", e => {
    if (mode !== "FOREX") return;
    if (e.key.toLowerCase() === "a") {
      marketActive = !marketActive;
      alert(`FOREX MARKET ACTIVE: ${marketActive ? "ON" : "OFF"}`);
    }
  });

  assetSelect.addEventListener("change", e => {
    connectTrade(e.target.value);
  });

  /* ===== DEFAULT ===== */
  connectTrade("BTC");
});
