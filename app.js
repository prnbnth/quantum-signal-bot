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

  /* ===== ASSETS (CRYPTO AUTO / FOREX MANUAL READY) ===== */
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
  function isActive(candles) {
    if (candles.length < 10) return false;
    const bodies = candles.map(c => Math.abs(c.close - c.open));
    const last = bodies.at(-1);
    const avg = bodies.slice(-10).reduce((a,b)=>a+b,0) / 10;
    return last >= avg * 1.05;
  }

  function vwap(candles) {
    let pv = 0, vol = candles.length;
    candles.forEach(c => {
      const typical = (c.high + c.low + c.close) / 3;
      pv += typical;
    });
    return pv / vol;
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
        <div>
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
      scannerData[k].push({
        open:+d.o, close:+d.c, high:+d.h, low:+d.l
      });
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

      tradeData.push({
        open:+k.o, close:+k.c, high:+k.h, low:+k.l
      });
      if (tradeData.length > 30) tradeData.shift();

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
    };
  }

  assetSelect.addEventListener("change", e => {
    connectTrade(e.target.value);
  });

  connectTrade("BTC");
});
