/*************************************************
 * TIME (IST) – LIVE CLOCK
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
 * GLOBAL UI REFERENCES
 *************************************************/
const signalBox = document.getElementById("signalBox");

/*************************************************
 * SIGNAL UI CONTROLLER
 *************************************************/
function setSignal(state) {
  signalBox.className = `signal-box ${state}`;

  if (state === "up") {
    signalBox.textContent = "UP";
  } else if (state === "down") {
    signalBox.textContent = "DOWN";
  } else {
    signalBox.textContent = "NO SIGNAL";
  }
}

/*************************************************
 * MARKET DATA STORAGE
 *************************************************/
let socket = null;
let candles = [];

/*************************************************
 * CONNECT TO LIVE MARKET (BINANCE – 1M)
 *************************************************/
function connectMarket(asset = "btcusdt") {
  if (socket) socket.close();

  candles = [];
  setSignal("neutral");

  socket = new WebSocket(
    `wss://stream.binance.com:9443/ws/${asset}@kline_1m`
  );

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const k = data.k;

    // process ONLY closed candles
    if (!k.x) return;

    candles.push({
      open: parseFloat(k.o),
      close: parseFloat(k.c)
    });

    if (candles.length > 50) candles.shift();

    evaluateSignal();
  };

  socket.onerror = () => {
    setSignal("neutral");
  };
}

/*************************************************
 * INDICATORS
 *************************************************/
function EMA(values, period) {
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function RSI(values, period = 14) {
  let gains = 0;
  let losses = 0;

  for (let i = values.length - period; i < values.length - 1; i++) {
    const diff = values[i + 1] - values[i];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

/*************************************************
 * SIGNAL EVALUATION LOGIC (1-MIN)
 *************************************************/
function evaluateSignal() {
  if (candles.length < 21) {
    setSignal("neutral");
    return;
  }

  const closes = candles.map(c => c.close);
  const opens  = candles.map(c => c.open);

  const ema9  = EMA(closes.slice(-9), 9);
  const ema21 = EMA(closes.slice(-21), 21);
  const rsi   = RSI(closes);

  const lastClose = closes.at(-1);
  const lastOpen  = opens.at(-1);

  // ---------- UP (CALL) ----------
  let confidence = 0;
  if (ema9 > ema21) confidence++;
  if (rsi > 50 && rsi < 70) confidence++;
  if (lastClose > lastOpen) confidence++;
  if (lastClose > ema21) confidence++;

  if (confidence >= 4) {
    setSignal("up");
    return;
  }

  // ---------- DOWN (PUT) ----------
  confidence = 0;
  if (ema9 < ema21) confidence++;
  if (rsi < 50 && rsi > 30) confidence++;
  if (lastClose < lastOpen) confidence++;
  if (lastClose < ema21) confidence++;

  if (confidence >= 4) {
    setSignal("down");
    return;
  }

  // ---------- NO TRADE ----------
  setSignal("neutral");
}

/*************************************************
 * INITIAL CONNECTION (DEFAULT ASSET)
 *************************************************/
connectMarket("btcusdt");
