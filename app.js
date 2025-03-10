import { Chart } from "@/components/ui/chart"
// Crypto Analysis Dashboard - Main JavaScript
document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const symbolSelect = document.getElementById("symbol-select")
  const timeframeSelect = document.getElementById("timeframe-select")
  const refreshBtn = document.getElementById("refresh-btn")
  const loadingElement = document.getElementById("loading")
  const dashboardContent = document.getElementById("dashboard-content")
  const chartSubtitle = document.getElementById("chart-subtitle")
  const priceChartCanvas = document.getElementById("price-chart")
  const indicatorsGrid = document.getElementById("indicators-grid")
  const signalsList = document.getElementById("signals-list")
  const apiErrorElement = document.getElementById("api-error")

  // UI elements for analysis results
  const sentimentBadge = document.getElementById("sentiment-badge")
  const sentimentText = document.getElementById("sentiment-text")
  const sentimentDescription = document.getElementById("sentiment-description")
  const signalStrengthBar = document.getElementById("signal-strength-bar")
  const signalStrengthValue = document.getElementById("signal-strength-value")
  const signalDescription = document.getElementById("signal-description")
  const roiValue = document.getElementById("roi-value")
  const roiIcon = document.getElementById("roi-icon")

  // Tab functionality
  const tabButtons = document.querySelectorAll(".tab-btn")
  const tabContents = document.querySelectorAll(".tab-content")

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach((btn) => btn.classList.remove("active"))
      tabContents.forEach((content) => content.classList.remove("active"))

      // Add active class to clicked button and corresponding content
      button.classList.add("active")
      const tabId = button.getAttribute("data-tab")
      document.getElementById(`${tabId}-tab`).classList.add("active")
    })
  })

  // Chart instance
  let priceChart = null

  // Load data function
  function loadData() {
    const symbol = symbolSelect.value
    const timeframe = timeframeSelect.value

    // Show loading state
    loadingElement.style.display = "flex"
    dashboardContent.style.display = "none"
    apiErrorElement.style.display = "none"

    // Update chart subtitle
    chartSubtitle.textContent = `${symbol} price chart with key support and resistance levels`

    // Fetch data from Binance API
    fetchBinanceData(symbol, timeframe)
      .then((data) => {
        // Analyze the data
        const analysis = analyzeMarket(data)

        // Update UI with analysis results
        updateAnalysisUI(analysis)

        // Initialize or update chart
        if (priceChart) {
          priceChart.destroy()
        }

        // Create new chart
        createPriceChart(priceChartCanvas, data)

        // Render indicators
        renderIndicators(indicatorsGrid, data)

        // Render signals
        renderSignals(signalsList, analysis.signals)

        // Show dashboard content
        loadingElement.style.display = "none"
        dashboardContent.style.display = "block"
      })
      .catch((error) => {
        console.error("Error fetching data:", error)
        apiErrorElement.style.display = "flex"

        // Use mock data as fallback
        const mockData = generateMockData(symbol, timeframe)
        const analysis = analyzeMarket(mockData)

        // Update UI with analysis results
        updateAnalysisUI(analysis)

        // Initialize or update chart
        if (priceChart) {
          priceChart.destroy()
        }

        // Create new chart
        createPriceChart(priceChartCanvas, mockData)

        // Render indicators
        renderIndicators(indicatorsGrid, mockData)

        // Render signals
        renderSignals(signalsList, analysis.signals)

        // Show dashboard content
        loadingElement.style.display = "none"
        dashboardContent.style.display = "block"
      })
  }

  // Fetch data from Binance API
  async function fetchBinanceData(symbol, timeframe) {
    // Convert timeframe to Binance format
    const interval = timeframeToInterval(timeframe)

    // Calculate start time (100 candles back)
    const endTime = Date.now()

    // Fetch klines data from Binance API
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`,
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const klines = await response.json()

    // Transform klines data to our format
    const data = klines.map((kline) => ({
      time: kline[0], // Open time
      open: Number.parseFloat(kline[1]),
      high: Number.parseFloat(kline[2]),
      low: Number.parseFloat(kline[3]),
      close: Number.parseFloat(kline[4]),
      volume: Number.parseFloat(kline[5]),
    }))

    // Calculate indicators
    return enrichDataWithIndicators(data)
  }

  // Convert timeframe to Binance interval format
  function timeframeToInterval(timeframe) {
    switch (timeframe) {
      case "5m":
        return "5m"
      case "15m":
        return "15m"
      case "1h":
        return "1h"
      case "4h":
        return "4h"
      case "1d":
        return "1d"
      default:
        return "4h"
    }
  }

  // Generate mock data (fallback)
  function generateMockData(symbol, timeframe) {
    const data = []
    const periods = 100

    // Set base price based on symbol
    let basePrice
    if (symbol === "BTCUSDT") {
      basePrice = 65000
    } else if (symbol === "ETHUSDT") {
      basePrice = 3500
    } else if (symbol === "BNBUSDT") {
      basePrice = 600
    } else if (symbol === "ADAUSDT") {
      basePrice = 0.5
    } else if (symbol === "SOLUSDT") {
      basePrice = 150
    } else {
      basePrice = 50
    }

    // Set volatility based on timeframe
    let volatility
    if (timeframe === "1d") {
      volatility = basePrice * 0.05 // 5% daily volatility
    } else if (timeframe === "4h") {
      volatility = basePrice * 0.02 // 2% 4-hour volatility
    } else {
      volatility = basePrice * 0.01 // 1% hourly/minute volatility
    }

    // Generate price data with a slight trend
    let price = basePrice
    const trend = Math.random() > 0.5 ? 1 : -1 // Random trend direction

    const now = new Date()
    let time = new Date(now)

    // Adjust time based on timeframe
    const timeframeMinutes = timeframeToMinutes(timeframe)
    time.setMinutes(time.getMinutes() - periods * timeframeMinutes)

    for (let i = 0; i < periods; i++) {
      // Add some randomness with a slight trend bias
      const change = Math.random() * volatility * 2 - volatility + trend * volatility * 0.1
      const open = price
      price = Math.max(0.001, price + change) // Ensure price doesn't go negative
      const high = Math.max(open, price) + Math.random() * volatility * 0.5
      const low = Math.min(open, price) - Math.random() * volatility * 0.5
      const close = price
      const volume = Math.random() * 1000000 + 500000

      time = new Date(time.getTime() + timeframeMinutes * 60 * 1000)

      data.push({
        time: time.getTime(),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume,
      })
    }

    // Calculate indicators
    return enrichDataWithIndicators(data)
  }

  // Helper function to convert timeframe to minutes
  function timeframeToMinutes(timeframe) {
    switch (timeframe) {
      case "5m":
        return 5
      case "15m":
        return 15
      case "1h":
        return 60
      case "4h":
        return 240
      case "1d":
        return 1440
      default:
        return 60
    }
  }

  // Enrich data with technical indicators
  function enrichDataWithIndicators(data) {
    const closes = data.map((d) => d.close)

    // Calculate simple moving averages
    const sma20 = calculateSMA(closes, 20)
    const sma50 = calculateSMA(closes, 50)

    // Calculate RSI
    const rsi = calculateRSI(closes, 14)

    // Calculate MACD
    const macd = calculateMACD(closes)

    // Calculate Bollinger Bands
    const bbands = calculateBollingerBands(closes)

    // Combine all data
    return data.map((item, i) => ({
      ...item,
      sma20: sma20[i],
      sma50: sma50[i],
      rsi: rsi[i] || 50,
      macd: macd.macdLine[i] || 0,
      macdSignal: macd.signalLine[i] || 0,
      macdHistogram: macd.histogram[i] || 0,
      bbandsUpper: bbands.upper[i] || item.close * 1.02,
      bbandsMiddle: bbands.middle[i] || item.close,
      bbandsLower: bbands.lower[i] || item.close * 0.98,
    }))
  }

  // Calculate Simple Moving Average
  function calculateSMA(data, period) {
    const sma = []

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null)
      } else {
        let sum = 0
        for (let j = i - period + 1; j <= i; j++) {
          sum += data[j]
        }
        sma.push(sum / period)
      }
    }

    return sma
  }

  // Calculate RSI
  function calculateRSI(data, period) {
    const rsi = []
    let gains = 0
    let losses = 0

    // First, calculate average gain and loss over the first period
    for (let i = 1; i <= period; i++) {
      if (i >= data.length) break
      const change = data[i] - data[i - 1]
      if (change >= 0) {
        gains += change
      } else {
        losses -= change
      }
    }

    let avgGain = gains / period
    let avgLoss = losses / period

    // Calculate RSI for the first period
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi.push(100 - 100 / (1 + rs))

    // Calculate RSI for the rest of the data
    for (let i = period + 1; i < data.length; i++) {
      const change = data[i] - data[i - 1]
      let currentGain = 0
      let currentLoss = 0

      if (change >= 0) {
        currentGain = change
      } else {
        currentLoss = -change
      }

      // Use smoothed averages
      avgGain = (avgGain * (period - 1) + currentGain) / period
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      rsi.push(100 - 100 / (1 + rs))
    }

    // Pad the beginning with null values
    const padding = Array(data.length - rsi.length).fill(null)
    return [...padding, ...rsi]
  }

  // Calculate MACD
  function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    // Calculate EMAs
    const fastEMA = calculateEMA(data, fastPeriod)
    const slowEMA = calculateEMA(data, slowPeriod)

    // Calculate MACD line
    const macdLine = []
    for (let i = 0; i < data.length; i++) {
      if (fastEMA[i] !== null && slowEMA[i] !== null) {
        macdLine.push(fastEMA[i] - slowEMA[i])
      } else {
        macdLine.push(null)
      }
    }

    // Calculate signal line (EMA of MACD line)
    const validMacd = macdLine.filter((val) => val !== null)
    const signalLine = calculateEMA(validMacd, signalPeriod)

    // Pad signal line with null values
    const signalLinePadded = Array(macdLine.length - signalLine.length)
      .fill(null)
      .concat(signalLine)

    // Calculate histogram
    const histogram = []
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null && signalLinePadded[i] !== null) {
        histogram.push(macdLine[i] - signalLinePadded[i])
      } else {
        histogram.push(null)
      }
    }

    return {
      macdLine,
      signalLine: signalLinePadded,
      histogram,
    }
  }

  // Calculate EMA
  function calculateEMA(data, period) {
    const k = 2 / (period + 1)
    const ema = []

    // Calculate SMA for the first period
    let sum = 0
    for (let i = 0; i < Math.min(period, data.length); i++) {
      sum += data[i]
    }
    let currentEMA = sum / Math.min(period, data.length)
    ema.push(currentEMA)

    // Calculate EMA for the rest of the data
    for (let i = 1; i < data.length; i++) {
      currentEMA = data[i] * k + currentEMA * (1 - k)
      ema.push(currentEMA)
    }

    return ema
  }

  // Calculate Bollinger Bands
  function calculateBollingerBands(data, period = 20, multiplier = 2) {
    const sma = calculateSMA(data, period)

    const upper = []
    const lower = []

    for (let i = 0; i < data.length; i++) {
      if (sma[i] === null) {
        upper.push(null)
        lower.push(null)
      } else {
        // Calculate standard deviation
        let sum = 0
        for (let j = Math.max(0, i - period + 1); j <= i; j++) {
          sum += Math.pow(data[j] - sma[i], 2)
        }
        const stdDev = Math.sqrt(sum / period)

        upper.push(sma[i] + multiplier * stdDev)
        lower.push(sma[i] - multiplier * stdDev)
      }
    }

    return {
      upper,
      middle: sma,
      lower,
    }
  }

  // Analyze market data
  function analyzeMarket(data) {
    const latestData = data[data.length - 1]
    const previousData = data[data.length - 2]

    // Determine market sentiment
    let sentiment = "neutral"
    let sentimentDescription = ""

    if (latestData.close > latestData.sma20 && latestData.sma20 > latestData.sma50 && latestData.rsi > 50) {
      sentiment = "bullish"
      sentimentDescription =
        "Multiple indicators suggest a bullish trend. Price is above key moving averages with positive momentum."
    } else if (latestData.close < latestData.sma20 && latestData.sma20 < latestData.sma50 && latestData.rsi < 50) {
      sentiment = "bearish"
      sentimentDescription =
        "Multiple indicators suggest a bearish trend. Price is below key moving averages with negative momentum."
    } else {
      sentimentDescription =
        "Mixed signals from different indicators. The market appears to be in a consolidation phase."
    }

    // Calculate signal strength (0-100)
    let signalStrength = 50 // Start with neutral

    // Trend analysis
    if (latestData.close > latestData.sma20 && latestData.sma20 > latestData.sma50) {
      signalStrength += 10 // Strong uptrend
    } else if (latestData.close < latestData.sma20 && latestData.sma20 < latestData.sma50) {
      signalStrength -= 10 // Strong downtrend
    }

    // RSI analysis
    if (latestData.rsi > 70) {
      signalStrength -= 5 // Overbought
    } else if (latestData.rsi < 30) {
      signalStrength += 5 // Oversold
    }

    // MACD analysis
    if (latestData.macd > latestData.macdSignal && latestData.macd > 0) {
      signalStrength += 7 // Strong bullish
    } else if (latestData.macd < latestData.macdSignal && latestData.macd < 0) {
      signalStrength -= 7 // Strong bearish
    }

    // Ensure strength is between 0 and 100
    signalStrength = Math.max(0, Math.min(100, signalStrength))

    // Signal description based on strength
    let signalDescription = ""
    if (signalStrength > 70) {
      signalDescription = "Strong confluence of multiple indicators suggesting high probability setup."
    } else if (signalStrength > 50) {
      signalDescription = "Moderate signal strength with some confirming indicators."
    } else {
      signalDescription = "Weak signal strength. Consider waiting for more confirmation."
    }

    // Calculate potential ROI
    const volatility = ((latestData.high - latestData.low) / latestData.close) * 100
    let potentialRoi = 0

    if (sentiment === "bullish") {
      potentialRoi = 2 + volatility * 0.5 // Base 2% plus volatility adjustment
    } else if (sentiment === "bearish") {
      potentialRoi = -2 - volatility * 0.5 // Base -2% plus volatility adjustment
    } else {
      potentialRoi = volatility * 0.3 // Neutral sentiment, smaller potential
    }

    // Limit ROI to reasonable range
    potentialRoi = Math.max(-5, Math.min(5, potentialRoi))

    // Generate trading signals
    const signals = generateSignals(data)

    return {
      sentiment,
      sentimentDescription,
      signalStrength,
      signalDescription,
      potentialRoi,
      signals,
    }
  }

  // Generate trading signals
  function generateSignals(data) {
    const signals = []
    const latestData = data[data.length - 1]

    // Check for RSI signals
    if (data.length > 2 && data[data.length - 2].rsi < 30 && latestData.rsi > 30) {
      signals.push({
        type: "buy",
        time: new Date(latestData.time).toLocaleString(),
        price: latestData.close.toFixed(2),
        indicator: "RSI",
        strength: 75,
        description: "RSI crossed above 30, indicating a potential reversal from oversold conditions.",
        targetPrice: (latestData.close * 1.03).toFixed(2), // 3% target
        stopLoss: (latestData.close * 0.98).toFixed(2), // 2% stop loss
        potentialRoi: 3,
      })
    }

    if (data.length > 2 && data[data.length - 2].rsi > 70 && latestData.rsi < 70) {
      signals.push({
        type: "sell",
        time: new Date(latestData.time).toLocaleString(),
        price: latestData.close.toFixed(2),
        indicator: "RSI",
        strength: 75,
        description: "RSI crossed below 70, indicating a potential reversal from overbought conditions.",
        targetPrice: (latestData.close * 0.97).toFixed(2), // 3% target
        stopLoss: (latestData.close * 1.02).toFixed(2), // 2% stop loss
        potentialRoi: 3,
      })
    }

    // Check for MACD signals
    if (
      data.length > 2 &&
      data[data.length - 2].macd < data[data.length - 2].macdSignal &&
      latestData.macd > latestData.macdSignal
    ) {
      signals.push({
        type: "buy",
        time: new Date(latestData.time).toLocaleString(),
        price: latestData.close.toFixed(2),
        indicator: "MACD",
        strength: 65,
        description: "MACD line crossed above signal line, indicating bullish momentum.",
        targetPrice: (latestData.close * 1.025).toFixed(2), // 2.5% target
        stopLoss: (latestData.close * 0.985).toFixed(2), // 1.5% stop loss
        potentialRoi: 2.5,
      })
    }

    // Add a default signal if none were generated
    if (signals.length === 0) {
      if (Math.random() > 0.5) {
        signals.push({
          type: "buy",
          time: new Date(latestData.time).toLocaleString(),
          price: latestData.close.toFixed(2),
          indicator: "Multiple Indicators",
          strength: 60 + Math.floor(Math.random() * 20),
          description: "Confluence of multiple indicators suggesting a potential buying opportunity.",
          targetPrice: (latestData.close * 1.03).toFixed(2),
          stopLoss: (latestData.close * 0.98).toFixed(2),
          potentialRoi: 3,
        })
      } else {
        signals.push({
          type: "sell",
          time: new Date(latestData.time).toLocaleString(),
          price: latestData.close.toFixed(2),
          indicator: "Multiple Indicators",
          strength: 60 + Math.floor(Math.random() * 20),
          description: "Confluence of multiple indicators suggesting a potential selling opportunity.",
          targetPrice: (latestData.close * 0.97).toFixed(2),
          stopLoss: (latestData.close * 1.02).toFixed(2),
          potentialRoi: 3,
        })
      }
    }

    return signals
  }

  // Create price chart
  function createPriceChart(canvas, data) {
    const ctx = canvas.getContext("2d")

    // Format data for Chart.js
    const labels = data.map((d) => {
      const date = new Date(d.time)
      return date.toLocaleDateString()
    })

    const prices = data.map((d) => d.close)
    const sma20 = data.map((d) => d.sma20)
    const sma50 = data.map((d) => d.sma50)

    // Create chart
    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Price",
            data: prices,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.1,
          },
          {
            label: "SMA 20",
            data: sma20,
            borderColor: "#10b981",
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
          },
          {
            label: "SMA 50",
            data: sma50,
            borderColor: "#f59e0b",
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 10,
            },
            grid: {
              display: false,
            },
          },
          y: {
            position: "right",
            grid: {
              color: "rgba(229, 231, 235, 0.5)",
            },
          },
        },
        plugins: {
          legend: {
            position: "top",
            labels: {
              boxWidth: 12,
            },
          },
          tooltip: {
            mode: "index",
            intersect: false,
          },
        },
      },
    })

    return priceChart
  }

  // Render technical indicators
  function renderIndicators(container, data) {
    // Get the most recent data point
    const latestData = data[data.length - 1]

    // Define indicators to display
    const indicators = [
      {
        name: "RSI (14)",
        value: latestData.rsi.toFixed(2),
        interpretation: interpretRSI(latestData.rsi),
        description: "Relative Strength Index measures the speed and change of price movements.",
      },
      {
        name: "MACD",
        value: latestData.macd.toFixed(4),
        interpretation: interpretMACD(latestData.macd, latestData.macdSignal),
        description: "Moving Average Convergence Divergence is a trend-following momentum indicator.",
      },
      {
        name: "Bollinger Bands",
        value: `Width: ${(((latestData.bbandsUpper - latestData.bbandsLower) / latestData.bbandsMiddle) * 100).toFixed(2)}%`,
        interpretation: interpretBollingerBands(latestData.close, latestData.bbandsUpper, latestData.bbandsLower),
        description: "Bollinger Bands measure volatility and potential reversal points.",
      },
      {
        name: "SMA Crossover",
        value: `20: ${latestData.sma20.toFixed(2)} / 50: ${latestData.sma50.toFixed(2)}`,
        interpretation: interpretSMACrossover(latestData.sma20, latestData.sma50),
        description: "Simple Moving Average crossovers can indicate trend changes.",
      },
    ]

    // Clear container
    container.innerHTML = ""

    // Create indicator cards
    indicators.forEach((indicator) => {
      const card = document.createElement("div")
      card.className = "indicator-card"

      const header = document.createElement("div")
      header.className = "indicator-header"

      const nameElement = document.createElement("div")
      nameElement.className = "indicator-name"
      nameElement.textContent = indicator.name

      const badge = document.createElement("div")
      badge.className = `badge ${indicator.interpretation.type}`

      const icon = document.createElement("i")
      if (indicator.interpretation.type === "bullish") {
        icon.className = "fas fa-arrow-up"
      } else if (indicator.interpretation.type === "bearish") {
        icon.className = "fas fa-arrow-down"
      } else {
        icon.className = "fas fa-minus"
      }

      const badgeText = document.createElement("span")
      badgeText.textContent =
        indicator.interpretation.type.charAt(0).toUpperCase() + indicator.interpretation.type.slice(1)

      badge.appendChild(icon)
      badge.appendChild(badgeText)

      header.appendChild(nameElement)
      header.appendChild(badge)

      const valueElement = document.createElement("div")
      valueElement.className = "indicator-value"
      valueElement.textContent = indicator.value

      const interpretationElement = document.createElement("div")
      interpretationElement.className = "description"
      interpretationElement.textContent = indicator.interpretation.text

      const descriptionElement = document.createElement("div")
      descriptionElement.className = "description"
      descriptionElement.textContent = indicator.description

      card.appendChild(header)
      card.appendChild(valueElement)
      card.appendChild(interpretationElement)
      card.appendChild(descriptionElement)

      container.appendChild(card)
    })
  }

  // Render trading signals
  function renderSignals(container, signals) {
    // Clear container
    container.innerHTML = ""

    if (!signals || signals.length === 0) {
      const noSignals = document.createElement("div")
      noSignals.className = "no-signals"
      noSignals.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <h3>No signals detected</h3>
                <p>There are currently no trading signals based on your selected timeframe and indicators.
                Try changing the timeframe or check back later.</p>
            `
      container.appendChild(noSignals)
      return
    }

    // Create signal cards
    signals.forEach((signal) => {
      const card = document.createElement("div")
      card.className = `signal-card ${signal.type}`

      const header = document.createElement("div")
      header.className = "signal-header"

      const typeContainer = document.createElement("div")
      typeContainer.className = "signal-type"

      const badge = document.createElement("div")
      badge.className = `badge ${signal.type === "buy" ? "bullish" : "bearish"}`

      const icon = document.createElement("i")
      icon.className = signal.type === "buy" ? "fas fa-arrow-up" : "fas fa-arrow-down"

      const badgeText = document.createElement("span")
      badgeText.textContent = signal.type.toUpperCase()

      badge.appendChild(icon)
      badge.appendChild(badgeText)

      const indicatorName = document.createElement("span")
      indicatorName.textContent = signal.indicator

      typeContainer.appendChild(badge)
      typeContainer.appendChild(indicatorName)

      const timeElement = document.createElement("div")
      timeElement.className = "signal-time"
      timeElement.textContent = signal.time

      header.appendChild(typeContainer)
      header.appendChild(timeElement)

      const details = document.createElement("div")
      details.className = "signal-details"

      // Entry Price
      const entryPriceContainer = document.createElement("div")
      entryPriceContainer.className = "signal-detail"

      const entryPriceLabel = document.createElement("div")
      entryPriceLabel.className = "signal-detail-label"
      entryPriceLabel.textContent = "Entry Price"

      const entryPriceValue = document.createElement("div")
      entryPriceValue.className = "signal-detail-value"
      entryPriceValue.textContent = signal.price

      entryPriceContainer.appendChild(entryPriceLabel)
      entryPriceContainer.appendChild(entryPriceValue)

      // Target Price
      const targetPriceContainer = document.createElement("div")
      targetPriceContainer.className = "signal-detail"

      const targetPriceLabel = document.createElement("div")
      targetPriceLabel.className = "signal-detail-label"
      targetPriceLabel.textContent = "Target Price"

      const targetPriceValue = document.createElement("div")
      targetPriceValue.className = "signal-detail-value"
      targetPriceValue.textContent = signal.targetPrice

      targetPriceContainer.appendChild(targetPriceLabel)
      targetPriceContainer.appendChild(targetPriceValue)

      // Stop Loss
      const stopLossContainer = document.createElement("div")
      stopLossContainer.className = "signal-detail"

      const stopLossLabel = document.createElement("div")
      stopLossLabel.className = "signal-detail-label"
      stopLossLabel.textContent = "Stop Loss"

      const stopLossValue = document.createElement("div")
      stopLossValue.className = "signal-detail-value"
      stopLossValue.textContent = signal.stopLoss

      stopLossContainer.appendChild(stopLossLabel)
      stopLossContainer.appendChild(stopLossValue)

      // Potential ROI
      const roiContainer = document.createElement("div")
      roiContainer.className = "signal-detail"

      const roiLabel = document.createElement("div")
      roiLabel.className = "signal-detail-label"
      roiLabel.textContent = "Potential ROI"

      const roiValue = document.createElement("div")
      roiValue.className = "signal-detail-value"
      roiValue.textContent = `${signal.potentialRoi.toFixed(2)}%`
      roiValue.style.color = signal.potentialRoi > 0 ? "var(--success)" : "var(--danger)"

      roiContainer.appendChild(roiLabel)
      roiContainer.appendChild(roiValue)

      details.appendChild(entryPriceContainer)
      details.appendChild(targetPriceContainer)
      details.appendChild(stopLossContainer)
      details.appendChild(roiContainer)

      const descriptionContainer = document.createElement("div")
      descriptionContainer.className = "description"
      descriptionContainer.textContent = signal.description

      card.appendChild(header)
      card.appendChild(details)
      card.appendChild(descriptionContainer)

      container.appendChild(card)
    })
  }

  // Helper functions for interpreting indicators
  function interpretRSI(rsi) {
    if (rsi > 70) return { type: "bearish", text: "Overbought" }
    if (rsi < 30) return { type: "bullish", text: "Oversold" }
    if (rsi > 50) return { type: "bullish", text: "Bullish momentum" }
    return { type: "bearish", text: "Bearish momentum" }
  }

  function interpretMACD(macd, signal) {
    if (macd > signal && macd > 0) return { type: "bullish", text: "Strong bullish" }
    if (macd > signal && macd < 0) return { type: "bullish", text: "Bullish crossover" }
    if (macd < signal && macd < 0) return { type: "bearish", text: "Strong bearish" }
    if (macd < signal && macd > 0) return { type: "bearish", text: "Bearish crossover" }
    return { type: "neutral", text: "Neutral" }
  }

  function interpretBollingerBands(price, upper, lower) {
    if (price >= upper) return { type: "bearish", text: "Overbought" }
    if (price <= lower) return { type: "bullish", text: "Oversold" }
    return { type: "neutral", text: "Within bands" }
  }

  function interpretSMACrossover(sma20, sma50) {
    if (sma20 > sma50) return { type: "bullish", text: "Bullish trend" }
    if (sma20 < sma50) return { type: "bearish", text: "Bearish trend" }
    return { type: "neutral", text: "Neutral trend" }
  }

  // Update UI with analysis results
  function updateAnalysisUI(analysis) {
    // Update sentiment
    sentimentText.textContent = analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1)
    sentimentDescription.textContent = analysis.sentimentDescription

    // Update sentiment badge
    sentimentBadge.className = "badge"
    if (analysis.sentiment === "bullish") {
      sentimentBadge.classList.add("bullish")
      sentimentBadge.innerHTML = '<i class="fas fa-arrow-up"></i> Bullish'
    } else if (analysis.sentiment === "bearish") {
      sentimentBadge.classList.add("bearish")
      sentimentBadge.innerHTML = '<i class="fas fa-arrow-down"></i> Bearish'
    } else {
      sentimentBadge.innerHTML = '<i class="fas fa-minus"></i> Neutral'
    }

    // Update signal strength
    signalStrengthValue.textContent = Math.round(analysis.signalStrength)
    signalStrengthBar.style.width = `${analysis.signalStrength}%`
    signalDescription.textContent = analysis.signalDescription

    // Update signal strength bar color
    signalStrengthBar.className = "progress-bar"
    if (analysis.signalStrength > 70) {
      signalStrengthBar.classList.add("strong")
    } else if (analysis.signalStrength < 30) {
      signalStrengthBar.classList.add("weak")
    }

    // Update ROI
    const roi = analysis.potentialRoi.toFixed(2)
    roiValue.textContent = `${roi}%`

    // Update ROI color and icon
    if (analysis.potentialRoi > 0) {
      roiValue.className = "roi-value roi-positive"
      roiIcon.className = "fas fa-arrow-up"
      roiIcon.style.color = "var(--success)"
    } else if (analysis.potentialRoi < 0) {
      roiValue.className = "roi-value roi-negative"
      roiIcon.className = "fas fa-arrow-down"
      roiIcon.style.color = "var(--danger)"
    } else {
      roiValue.className = "roi-value"
      roiIcon.className = "fas fa-minus"
    }
  }

  // Event listeners
  symbolSelect.addEventListener("change", loadData)
  timeframeSelect.addEventListener("change", loadData)
  refreshBtn.addEventListener("click", loadData)

  // Initial load
  loadData()
})

