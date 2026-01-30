document.addEventListener("DOMContentLoaded", () => {

  /* ===== TIME ===== */
  const timeBox = document.getElementById("time");
  setInterval(() => {
    timeBox.textContent =
      new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  }, 1000);

  /* ===== UI ===== */
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

  /* ===== CRYPTO ASSETS ===== */
  const ASSETS = {
    BTC: "btcusdt",
    ETH: "ethusdt",
    XRP: "xrpusdt",
    SOL: "solusdt"
  };

  let scannerData = {};
  let tradeCandles = [];
  let tradeSocket = null;

  /* ===== ACTIVITY SCORE ===== */
  function activityScore(c) {
    if (c.length < 10) return 0;
    const ranges = c.map(x => Math.abs(x.close - x.open));
    const last = ranges.at(-1);
    const avg = ranges.slice(-10).reduce((a,b)=>a+b,0) / 10;
    return last > avg * 1.2 ? 1 : 0;
  }

  /* ===== SCANNER RENDER ===== */
  function renderScanner() {
    scannerBox.innerHTML = "";

    Object.keys(scannerData).forEach(a => {
      const active = activityScore(scannerData[a]);
      const div = document.createElement("div");
      div.className = `scanner-item ${active ? "active" : "quiet"}`;
      div.innerHTML = `
        ${a}<br>
        ${active ? "🔥 ACTIVE" : "⚪ QUIET"}
      `;
      scannerBox.appendChild(div);
    });
  }

  /* ===== INIT SCANNER ===== */
  Object.keys(ASSETS).forEach(a => {
    scannerData[a] = [];
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${ASSETS[a]}@kline_1m`
    );
    ws.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;
      scannerData[a].push({ open:+k.o, close:+k.c });
      if (scannerData[a].length > 30)
        scannerData[a].shift();
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
      `wss://stream.binance.com:9443/ws/${ASSETS[asset]}@kline_1m`
    );

    tradeSocket.onmessage = e => {
      const k = JSON.parse(e.data).k;
      if (!k.x) return;
      tradeCandles.push({ open:+k.o, close:+k.c });
      if (tradeCandles.length > 30)
        tradeCandles.shift();
    };
  }

  assetSelect.addEventListener("change", e => {
    connectMarket(e.target.value);
  });

  connectMarket("BTC");
});
