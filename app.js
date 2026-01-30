document.addEventListener("DOMContentLoaded", () => {

  const timeBox = document.getElementById("time");
  setInterval(() => {
    timeBox.textContent =
      new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
  }, 1000);

  const scannerBox = document.getElementById("scanner");
  const assetSelect = document.getElementById("assetSelect");

  const ASSETS = {
    BTC: { symbol: "btcusdt", class: "btc", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg" },
    ETH: { symbol: "ethusdt", class: "eth", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg" },
    XRP: { symbol: "xrpusdt", class: "xrp", logo: "https://cryptologos.cc/logos/xrp-xrp-logo.svg" },
    SOL: { symbol: "solusdt", class: "sol", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg" }
  };

  let data = {};

  function isActive(c) {
    if (c.length < 10) return false;
    const r = c.map(x => Math.abs(x.close - x.open));
    return r.at(-1) > (r.slice(-10).reduce((a,b)=>a+b,0)/10) * 1.15;
  }

  function render() {
    scannerBox.innerHTML = "";
    Object.keys(data).forEach(k => {
      const div = document.createElement("div");
      div.className = `scanner-item ${ASSETS[k].class} ${isActive(data[k]) ? "active" : "quiet"}`;
      div.innerHTML = `
        <img src="${ASSETS[k].logo}">
        <div>${k}<br>${isActive(data[k]) ? "🔥 ACTIVE" : "⚪ QUIET"}</div>
      `;
      scannerBox.appendChild(div);
    });
  }

  Object.keys(ASSETS).forEach(k => {
    data[k] = [];
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ASSETS[k].symbol}@kline_1m`);
    ws.onmessage = e => {
      const d = JSON.parse(e.data).k;
      if (!d.x) return;
      data[k].push({ open:+d.o, close:+d.c });
      if (data[k].length > 30) data[k].shift();
      render();
    };
  });

});
