/*************************************************
 * IST CLOCK
 *************************************************/
function updateTime() {
  const now = new Date().toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata"
  });
  document.getElementById("time").textContent = now;
}
setInterval(updateTime, 1000);
updateTime();

/*************************************************
 * UI REFERENCES
 *************************************************/
const signalBox = document.getElementById("signalBox");

/*************************************************
 * SIGNAL UI
 *************************************************/
function setSignal(state) {
  signalBox.className = `signal-box ${state}`;
  signalBox.textContent =
    state === "up" ? "UP" :
    state === "down" ? "DOWN" :
    "NO SIGNAL";
}

/*************************************************
 * MARKET DATA
 *************************************************/
let socket = null;
let candles = [];
let currentAsset = "BTC";

/*************************************************
 * ASSET MAP
 *************************************************/
const ASSETS = {
  BTC: { type: "crypto", symbol: "btcusdt" },
  ETH: { type: "crypto", symbol: "ethusdt" },
  XRP: { type: "crypto", symbol: "xrpusdt" },
  SOL: { type: "crypto", symbol: "solusdt" },

  "EUR/USD": { type: "forex", tv: "FX:EURUSD" },
  "GBP/USD": { type: "forex", tv: "FX:GBPUSD" },
  "USD/JPY": { type: "forex", tv: "FX:USDJPY" },
  "XAU/USD": { type: "forex", tv: "OANDA:XAUUSD" },
  "XAG/USD": { type: "forex", tv: "OANDA:XAGUSD" },

  "OTC": { type: "forex", tv: "FX:EURUSD" }
};

/*************************************************
 * CONNECT MARKET
 *************************************************/
function connectMarket(assetKey) {
  if (socket) socket.close();
  candles = [];
  setSignal("neutral");

  currentAsset = assetKey;
  const asset = ASSETS[assetKey];

  if (asset.type === "crypto") {
    connectCrypto(asset.symbol);
  } else {
    connectForex(asset.tv);
  }
}

/*************************************************
 * CRYPTO (BINANCE WEBSOCKET)
 *************************************************/
function connectCrypto(symbol) {
  socket = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol}@kline_1m`
  );

  socket.onmessage = e => {
    const k = JSON.parse(e.data).k;
    if (!k.x) return;

    candles.push({
      open: +k.o,
      close: +k.c
    });

    if (candles.length > 50) candles.shift();
    evaluateSignal();
  };
}

/*************************************************
 * FOREX / METALS / OTC (POLLING)
 *************************************************/
async function connectForex(tvSymbol) {
  async function fetchCandle() {
    try {
      const url =
        `https://scanner.tradingview.com/symbol?symbol=${tvSymbol}&resolution=1`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data?.data?.length) return;

      const last = data.data.at(-1);
      candles.push({
        open: last[1],
        close: last[4]
      });

      if (candles.length > 50) candles.shift();
      evaluateSignal();
    } catch (e) {
      setSignal("neutral");
    }
  }

  fetchCandle();
  setInterval(fetchCandle, 60000);
}

/*************************************************
 * INDICATORS (SCALPING)
 *************************************************/
function EMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function RSI(values, period = 7) {
  let gains = 0, losses = 0;
  for (let i = values.length - period; i < values.length - 1; i++) {
    const d = values[i + 1] - values[i];
    d >= 0 ? gains += d : losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

/*************************************************
 * VOLATILITY FILTER
 *************************************************/
function avgBody() {
  const recent = candles.slice(-10);
  return recent.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / recent.length;
}

/*************************************************
 * SCALPING SIGNAL ENGINE
 *************************************************/
function evaluateSignal() {
  if (candles.length < 15) return setSignal("neutral");

  const closes = candles.map(c => c.close);
  const opens = candles.map(c => c.open);

  const ema5 = EMA(closes.slice(-5), 5);
  const ema13 = EMA(closes.slice(-13), 13);
  const rsi7 = RSI(closes);

  const lastClose = closes.at(-1);
  const lastOpen = opens.at(-1);
  const body = Math.abs(lastClose - lastOpen);

  if (
    ema5 > ema13 &&
    rsi7 > 55 &&
    lastClose > lastOpen &&
    body > avgBody()
  ) return setSignal("up");

  if (
    ema5 < ema13 &&
    rsi7 < 45 &&
    lastClose < lastOpen &&
    body > avgBody()
  ) return setSignal("down");

  setSignal("neutral");
}

/*************************************************
 * INITIAL LOAD
 *************************************************/
connectMarket("BTC");
