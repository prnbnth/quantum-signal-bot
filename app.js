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

  function setSignal(state) {
    signalBox.className = `signal-box ${state}`;
    signalBox.textContent =
      state === "up" ? "UP" :
      state === "down" ? "DOWN" :
      "NO SIGNAL";
  }

  /* ===== ASSETS ===== */
  const ASSETS = {
    BTC: {
      symbol: "btcusdt",
      class: "btc",
      logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg"
    },
    ETH: {
      symbol: "ethusdt",
      class: "eth",
      logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg"
    },
    XRP: {
      symbol: "xrpusdt",
      class: "xrp",
      logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg"
    },
    SOL: {
      symbol: "solusdt",
      class: "sol",
      logo: "https://cryptologos.cc/logos/solana-sol-logo.svg"
    }
  };

  let scannerData = {};
  let tradeSocket = null;
  let tradeCandles = [];

  /* ===== ACTIVITY CHECK ===== */
  function isActive(c) {
    if (c.length < 10) return false;
    const ranges = c.map(x => Math.abs(x.close - x.open));
    const last = ranges.at(-1);
    const avg = ranges.slice(-10).reduce((a,b)=>a+b,0) / 10;
    return last > avg * 1.15;
  }

  /* ===== RENDER SCANNER ===== */
  function renderScanner() {
    scannerBox.innerHTML = "";

    Object.keys(scannerData).forEach(k => {
      const active = isActive(scannerData[k]);
      const a = ASSETS[k];

      const div = document.createElement("div");
      div.className = `scanner-item ${a.class} ${active ? "active" : "quiet"}`;

      div.innerHTML = `
        <img src="${a.logo}" alt="${k}">
        <div class="scanner-text">
          ${k}<br>
          ${active ? "🔥 ACTIVE" : "⚪ QUIET"}
        </div>
      `;

      scannerBox.appendChild(div);
    });
  }

  /* ===== SCANNER SOCKETS ===== */
  Object.keys(ASSETS).forEach(k => {
    scannerData[k] = [];
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${ASSETS[k].symbol}@kline_1m`
    );
    ws.onmessage = e => {
      const d = JSON.parse(e.data).k;
      if (!d.x) return;
      scannerData[k].push({ open:+d.o, close:+d.c });
      if (scannerData[k].length > 30)
        scannerData[k].shift();
      renderScanner();
    };
  });

  /* ===== TRADE SOCKET ===== */
  function connectMarket(asset) {
    if (!ASSETS[asset]) return;
    if (tradeSocket) tradeSocket.close();
    tradeCandles = [];
    setSignal("neutral");

    tradeSocket = new WebSocket(
      `wss://stream.binance.com:9443/ws/${ASSETS[asset].symbol}@kline_1m`
    );

    tradeSocket.onmessage = e => {
      const d = JSON.parse(e.data).k;
      if (!d.x) return;
      tradeCandles.push({ open:+d.o, close:+d.c });
      if (tradeCandles.length > 30)
        tradeCandles.shift();
    };
  }

  assetSelect.addEventListener("change", e => {
    connectMarket(e.target.value);
  });

  connectMarket("BTC");
});
