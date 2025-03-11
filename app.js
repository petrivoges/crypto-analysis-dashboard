$(document).ready(() => {
  // DOM Elements
  const $symbolSelect = $("#symbol-select");
  const $timeframeSelect = $("#timeframe-select");
  const $refreshBtn = $("#refresh-btn");
  const $loadingElement = $("#loading");
  const $dashboardContent = $("#dashboard-content");
  const $apiErrorElement = $("#api-error");
  const $recommendationText = $("#recommendation-text");
  const $reasonsList = $("#reasons-list");
  const $chartSubtitle = $("#chart-subtitle");

  // Chart Instance
  let priceChart = null;

  // Initialize coin select dropdown
  initCoinSelect();

  // Load data function
  async function loadData() {
      const symbol = $symbolSelect.val();
      const timeframe = $timeframeSelect.val();

      // Update chart subtitle
      $chartSubtitle.text(`${symbol} price chart with key indicators`);

      // Show loading state
      $loadingElement.removeClass("d-none");
      $dashboardContent.addClass("d-none");
      $apiErrorElement.addClass("d-none");

      try {
          // Fetch klines data
          const data = await fetchKlines(symbol, timeframe);
          const enrichedData = enrichDataWithIndicators(data);

          // Load AI model and make prediction (placeholder)
          const model = await loadLSTMModel();
          const prediction = makePrediction(model, enrichedData);

          // Analyze market
          const analysis = analyzeMarket(enrichedData, prediction);

          // Update UI
          updateAnalysisUI(analysis);

          // Create or update chart
          if (priceChart) priceChart.destroy();
          priceChart = createPriceChart(enrichedData);

          // Show dashboard
          $loadingElement.addClass("d-none");
          $dashboardContent.removeClass("d-none");
      } catch (error) {
          console.error("Error loading data:", error);
          $apiErrorElement.removeClass("d-none");
          $loadingElement.addClass("d-none");
      }
  }

  // Initialize coin select dropdown
  async function initCoinSelect() {
      try {
          const response = await fetch("https://api.binance.com/api/v3/exchangeInfo");
          if (!response.ok) throw new Error("Failed to fetch exchange info");
          const data = await response.json();
          const usdtSymbols = data.symbols
              .filter((symbol) => symbol.quoteAsset === "USDT" && symbol.status === "TRADING")
              .map((symbol) => symbol.symbol)
              .slice(0, 20);
          $symbolSelect.empty();
          usdtSymbols.forEach((symbol) => {
              $symbolSelect.append(`<option value="${symbol}">${symbol}</option>`);
          });
          $symbolSelect.val("BTCUSDT");
      } catch (error) {
          console.error("Error initializing coin select:", error);
          const defaultSymbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT"];
          $symbolSelect.empty();
          defaultSymbols.forEach((symbol) => {
              $symbolSelect.append(`<option value="${symbol}">${symbol}</option>`);
          });
          $symbolSelect.val("BTCUSDT");
      }
  }

  // Fetch klines data from Binance API
  async function fetchKlines(symbol, interval) {
      const limit = 1000;
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch klines for ${symbol}`);
      const data = await response.json();
      return data.map((d) => ({
          openTime: d[0],
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
      }));
  }

  // Enrich data with technical indicators
  function enrichDataWithIndicators(data) {
      const closes = data.map((d) => d.close);
      const sma20 = calculateSMA(closes, 20);
      const rsi = calculateRSI(closes, 14);
      const macd = calculateMACD(closes);
      const valueArea = calculateValueArea(data);
      return data.map((item, i) => ({
          ...item,
          sma20: sma20[i],
          rsi: rsi[i],
          macd: macd.macdLine[i],
          macdSignal: macd.signalLine[i],
          valueAreaLow: valueArea.low,
          valueAreaHigh: valueArea.high,
      }));
  }

  // Calculate Simple Moving Average (SMA)
  function calculateSMA(data, period) {
      const sma = [];
      for (let i = 0; i < data.length; i++) {
          if (i < period - 1) {
              sma.push(null);
          } else {
              const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
              sma.push(sum / period);
          }
      }
      return sma;
  }

  // Calculate Relative Strength Index (RSI)
  function calculateRSI(data, period) {
      const rsi = [];
      for (let i = 0; i < data.length; i++) {
          if (i < period) {
              rsi.push(null);
          } else {
              let gain = 0, loss = 0;
              for (let j = i - period + 1; j <= i; j++) {
                  const change = data[j] - data[j - 1];
                  if (change > 0) gain += change;
                  else loss -= change;
              }
              const avgGain = gain / period;
              const avgLoss = loss / period;
              const rs = avgGain / (avgLoss || 0.0001); // Avoid division by zero
              rsi.push(100 - (100 / (1 + rs)));
          }
      }
      return rsi;
  }

  // Calculate Moving Average Convergence Divergence (MACD)
  function calculateMACD(data) {
      const ema12 = calculateEMA(data, 12);
      const ema26 = calculateEMA(data, 26);
      const macdLine = ema12.map((val, i) => val - ema26[i]);
      const signalLine = calculateEMA(macdLine.slice(26), 9);
      return { macdLine, signalLine: [...Array(26).fill(null), ...signalLine] };
  }

  // Calculate Exponential Moving Average (EMA)
  function calculateEMA(data, period) {
      const k = 2 / (period + 1);
      const ema = [data[0]];
      for (let i = 1; i < data.length; i++) {
          ema.push(data[i] * k + ema[i - 1] * (1 - k));
      }
      return ema;
  }

  // Calculate Value Area (simplified)
  function calculateValueArea(data) {
      const priceVolume = {};
      data.forEach((d) => {
          const price = Math.round(d.close * 100) / 100;
          priceVolume[price] = (priceVolume[price] || 0) + d.volume;
      });
      const sortedPrices = Object.entries(priceVolume).sort((a, b) => b[1] - a[1]);
      const totalVolume = sortedPrices.reduce((sum, [, vol]) => sum + vol, 0);
      let cumulativeVolume = 0;
      let valueAreaPrices = [];
      for (const [price, vol] of sortedPrices) {
          cumulativeVolume += vol;
          valueAreaPrices.push(parseFloat(price));
          if (cumulativeVolume >= totalVolume * 0.7) break;
      }
      return {
          low: Math.min(...valueAreaPrices),
          high: Math.max(...valueAreaPrices),
      };
  }

  // Load LSTM Model (Placeholder)
  async function loadLSTMModel() {
      // Replace with actual model URL hosted elsewhere
      // const model = await tf.loadLayersModel('https://example.com/path/to/model.json');
      // For now, return a mock model
      return {
          predict: (input) => {
              const lastClose = input.dataSync()[input.shape[0] - 1];
              tf.setBackend('cpu');
              return tf.tensor([lastClose * 1.01]); // Mock: predict 1% increase
          }
      };
  }

  // Make Prediction with LSTM Model
  function makePrediction(model, data) {
      tf.setBackend('cpu');
      const input = tf.tensor2d(data.map(d => [d.close]), [data.length, 1]);
      const prediction = model.predict(input);
      const result = prediction.dataSync()[0];
      input.dispose();
      prediction.dispose();
      return result;
  }

  // Analyze Market
  function analyzeMarket(data, aiPrediction) {
      const latest = data[data.length - 1];
      const reasons = [];
      let score = 0;

      if (latest.close > latest.sma20) {
          reasons.push("Price above SMA20");
          score += 1;
      } else {
          reasons.push("Price below SMA20");
          score -= 1;
      }
      if (latest.rsi > 50) {
          reasons.push("RSI above 50");
          score += 1;
      } else {
          reasons.push("RSI below 50");
          score -= 1;
      }
      if (latest.macd > latest.macdSignal) {
          reasons.push("MACD above signal line");
          score += 1;
      } else {
          reasons.push("MACD below signal line");
          score -= 1;
      }
      if (aiPrediction > latest.close) {
          reasons.push("AI predicts price increase");
          score += 1;
      } else {
          reasons.push("AI predicts price decrease");
          score -= 1;
      }

      let recommendation = score > 0 ? "Buy" : score < 0 ? "Sell" : "Neutral";
      return { recommendation, reasons };
  }

  // Create Candlestick Chart
  function createPriceChart(data) {
      const ctx = document.getElementById("price-chart").getContext("2d");
      if (priceChart) {
        priceChart.destroy(); // Remove the old chart
        priceChart = null;
      }
      priceChart = new Chart(ctx, {
          type: "candlestick",
          data: {
              datasets: [{
                  label: "Price",
                  data: data.map(d => ({
                      x: d.openTime,
                      o: d.open,
                      h: d.high,
                      l: d.low,
                      c: d.close
                  }))
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                  x: { type: "time", time: { unit: "minute" } },
                  y: { beginAtZero: false }
              }
          }
      });
      return priceChart;
  }

  // Update Analysis UI
  function updateAnalysisUI(analysis) {
      $recommendationText.text(analysis.recommendation);
      $reasonsList.empty();
      analysis.reasons.forEach(reason => {
          $reasonsList.append(`<li>${reason}</li>`);
      });
  }

  // Event Listeners
  $symbolSelect.on("change", loadData);
  $timeframeSelect.on("change", loadData);
  $refreshBtn.on("click", loadData);

  // Initial Load
  loadData();
});