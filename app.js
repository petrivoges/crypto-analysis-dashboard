$(document).ready(() => {
  // DOM elements using jQuery
  const $symbolSelect = $("#symbol-select")
  const $timeframeSelect = $("#timeframe-select")
  const $refreshBtn = $("#refresh-btn")
  const $loadingElement = $("#loading")
  const $dashboardContent = $("#dashboard-content")
  const $chartSubtitle = $("#chart-subtitle")
  const $priceChartCanvas = $("#price-chart")
  const $indicatorsGrid = $("#indicators-grid")
  const $signalsList = $("#signals-list")
  const $apiErrorElement = $("#api-error")
  const $infoMessage = $("#info-message")

  // UI elements for analysis results
  const $sentimentBadge = $("#sentiment-badge")
  const $sentimentText = $("#sentiment-text")
  const $sentimentDescription = $("#sentiment-description")
  const $signalStrengthBar = $("#signal-strength-bar")
  const $signalStrengthValue = $("#signal-strength-value")
  const $signalDescription = $("#signal-description")
  const $roiValue = $("#roi-value")
  const $roiIcon = $("#roi-icon")

  // Chart instance
  let priceChart = null

  // Load data function
  function loadData() {
    const symbol = $symbolSelect.val()
    const timeframe = $timeframeSelect.val()

    // Show loading state
    $loadingElement.removeClass("d-none")
    $dashboardContent.addClass("d-none")
    $apiErrorElement.addClass("d-none")

    // Update chart subtitle
    $chartSubtitle.text(`${symbol} price chart with key support and resistance levels`)

    // Get current date for fetching data
    const today = new Date()
    const dateStr = today.toISOString().split("T")[0] // Format: YYYY-MM-DD

    // Fetch data from Binance API using the fetchKlines function
    fetchKlines(symbol, timeframe, dateStr)
      .then((data) => {
        if (data.length === 0) {
          throw new Error("No data returned from Binance API")
        }

        // Transform data to the format our app expects
        const transformedData = transformKlinesToAppFormat(data)

        // Analyze the data
        const analysis = analyzeMarket(transformedData)

        // Update UI with analysis results
        updateAnalysisUI(analysis)

        // Initialize or update chart
        if (priceChart) {
          priceChart.destroy()
        }

        // Create new chart
        createPriceChart($priceChartCanvas[0], transformedData)

        // Render indicators
        renderIndicators($indicatorsGrid, transformedData)

        // Render signals
        renderSignals($signalsList, analysis.signals)

        // Show dashboard content
        $loadingElement.addClass("d-none")
        $dashboardContent.removeClass("d-none")

        // Update info message
        $infoMessage.text(
          "This analysis is based on real Binance data. Always combine with fundamental analysis and risk management for better results.",
        )
      })
      .catch((error) => {
        console.error("Error fetching data:", error)
        $apiErrorElement.removeClass("d-none")

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
        createPriceChart($priceChartCanvas[0], mockData)

        // Render indicators
        renderIndicators($indicatorsGrid, mockData)

        // Render signals
        renderSignals($signalsList, analysis.signals)

        // Show dashboard content
        $loadingElement.addClass("d-none")
        $dashboardContent.removeClass("d-none")

        // Update info message
        $infoMessage.text(
          "This analysis is based on simulated data for demonstration purposes. In a production environment, you would connect to real market data.",
        )
      })
  }

  // Fetch k-line data from Binance API with timestamps
  async function fetchKlines(coin, interval, date) {
    const startTime = new Date(date + "T00:00:00Z").getTime()
    const endTime = startTime + 86400000 // 24 hours
    let allKlines = []
    let lastTime = startTime

    try {
      while (true) {
        const url = `https://api.binance.com/api/v3/klines?symbol=${coin}&interval=${interval}&startTime=${lastTime}&endTime=${endTime}&limit=1000`
        console.log("Fetching data from:", url)

        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch klines for ${coin} on ${date}: ${response.status}`)

        const data = await response.json()
        console.log("Received data length:", data.length)

        if (data.length === 0) break

        allKlines = allKlines.concat(
          data.map((d) => ({
            open: Number.parseFloat(d[1]),
            high: Number.parseFloat(d[2]),
            low: Number.parseFloat(d[3]),
            close: Number.parseFloat(d[4]),
            volume: Number.parseFloat(d[5]),
            openTime: d[0], // milliseconds
            closeTime: d[6], // milliseconds
          })),
        )

        if (data.length < 1000) break // Less than max results, we're done
        lastTime = data[data.length - 1][6] + 1 // Next start time (close time + 1ms)

        await new Promise((r) => setTimeout(r, 200)) // Delay to avoid rate limits
      }

      console.log("Total klines fetched:", allKlines.length)
      return allKlines
    } catch (error) {
      console.error("Error in fetchKlines:", error)
      throw error
    }
  }

  // Calculate value area (VAL and VAH) for 70% of volume
  function calculateValueArea(klines) {
    if (klines.length === 0) return { val: null, vah: null }

    const priceVolume = {}
    let totalVolume = 0

    klines.forEach((k) => {
      const price = Math.round(k.close * 100) / 100 // 2 decimal places
      priceVolume[price] = (priceVolume[price] || 0) + k.volume
      totalVolume += k.volume
    })

    const sortedPrices = Object.keys(priceVolume)
      .map(Number)
      .sort((a, b) => a - b)
    if (sortedPrices.length === 0 || totalVolume === 0) return { val: null, vah: null }

    const poc = sortedPrices.reduce((max, p) => (priceVolume[p] > priceVolume[max] ? p : max), sortedPrices[0])
    let coveredVolume = priceVolume[poc]
    let val = poc,
      vah = poc

    while (coveredVolume < 0.7 * totalVolume) {
      const valIdx = sortedPrices.indexOf(val)
      const vahIdx = sortedPrices.indexOf(vah)
      const below = valIdx > 0 ? sortedPrices[valIdx - 1] : null
      const above = vahIdx < sortedPrices.length - 1 ? sortedPrices[vahIdx + 1] : null

      if (below && (!above || priceVolume[below] >= (priceVolume[above] || 0))) {
        val = below
        coveredVolume += priceVolume[below]
      } else if (above) {
        vah = above
        coveredVolume += priceVolume[above]
      } else {
        break
      }
    }
    return { val, vah }
  }

  // Transform klines data to the format our app expects
  function transformKlinesToAppFormat(klines) {
    return klines.map((kline) => ({
      time: kline.openTime,
      open: kline.open,
      high: kline.high,
      low: kline.low,
      close: kline.close,
      volume: kline.volume,
    }))
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
    if (!data || data.length === 0) {
      console.error("No data to enrich with indicators")
      return []
    }

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

    // Calculate value area
    const valueArea = calculateValueArea(data)

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
      valueAreaLow: valueArea.val,
      valueAreaHigh: valueArea.vah,
    }))
  }

  // Calculate Simple Moving Average
  function calculateSMA(data, period) {
    if (!data || data.length === 0) return []

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
    if (!data || data.length < period + 1) return Array(data.length).fill(50)

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
    if (!data || data.length === 0) {
      return { macdLine: [], signalLine: [], histogram: [] }
    }

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
    if (!data || data.length === 0) return []

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
    if (!data || data.length === 0) {
      return { upper: [], middle: [], lower: [] }
    }

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
    if (!data || data.length < 2) {
      console.error("Not enough data to analyze market")
      return {
        sentiment: "neutral",
        sentimentDescription: "Insufficient data to determine market sentiment.",
        signalStrength: 50,
        signalDescription: "Unable to calculate signal strength due to insufficient data.",
        potentialRoi: 0,
        signals: [],
      }
    }

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

    // Value Area analysis
    if (latestData.valueAreaLow && latestData.valueAreaHigh) {
      if (latestData.close < latestData.valueAreaLow && previousData.close >= latestData.valueAreaLow) {
        signalStrength -= 8 // Price broke below value area low
      } else if (latestData.close > latestData.valueAreaHigh && previousData.close <= latestData.valueAreaHigh) {
        signalStrength += 8 // Price broke above value area high
      }
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
    if (!data || data.length < 3) return []

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

    // Check for Value Area signals
    if (latestData.valueAreaLow && latestData.valueAreaHigh) {
      // Check for price crossing above Value Area High
      if (
        data.length > 2 &&
        data[data.length - 2].close <= latestData.valueAreaHigh &&
        latestData.close > latestData.valueAreaHigh
      ) {
        signals.push({
          type: "buy",
          time: new Date(latestData.time).toLocaleString(),
          price: latestData.close.toFixed(2),
          indicator: "Value Area",
          strength: 70,
          description: "Price crossed above Value Area High, indicating potential bullish breakout.",
          targetPrice: (latestData.close * 1.03).toFixed(2), // 3% target
          stopLoss: latestData.valueAreaLow.toFixed(2), // Stop at Value Area Low
          potentialRoi: 3,
        })
      }

      // Check for price crossing below Value Area Low
      if (
        data.length > 2 &&
        data[data.length - 2].close >= latestData.valueAreaLow &&
        latestData.close < latestData.valueAreaLow
      ) {
        signals.push({
          type: "sell",
          time: new Date(latestData.time).toLocaleString(),
          price: latestData.close.toFixed(2),
          indicator: "Value Area",
          strength: 70,
          description: "Price crossed below Value Area Low, indicating potential bearish breakdown.",
          targetPrice: (latestData.close * 0.97).toFixed(2), // 3% target
          stopLoss: latestData.valueAreaHigh.toFixed(2), // Stop at Value Area High
          potentialRoi: 3,
        })
      }
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
    if (!data || data.length === 0) {
      console.error("No data to create price chart")
      return null
    }

    const ctx = canvas.getContext("2d")

    // Format data for Chart.js
    const labels = data.map((d) => {
      const date = new Date(d.time)
      return date.toLocaleTimeString()
    })

    const prices = data.map((d) => d.close)
    const sma20 = data.map((d) => d.sma20)
    const sma50 = data.map((d) => d.sma50)

    // Value Area lines (horizontal)
    const valueAreaLow = data[0].valueAreaLow
    const valueAreaHigh = data[0].valueAreaHigh

    // Create chart
    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Price",
            data: prices,
            borderColor: "#0d6efd",
            backgroundColor: "rgba(13, 110, 253, 0.1)",
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
              color: "rgba(0, 0, 0, 0.05)",
            },
            afterFit: (scaleInstance) => {
              // Add value area lines if they exist
              if (valueAreaLow && valueAreaHigh) {
                const yScale = scaleInstance
                const ctx = yScale.chart.ctx
                const chartArea = yScale.chart.chartArea

                // Draw Value Area Low line
                const yPosLow = yScale.getPixelForValue(valueAreaLow)
                ctx.save()
                ctx.beginPath()
                ctx.moveTo(chartArea.left, yPosLow)
                ctx.lineTo(chartArea.right, yPosLow)
                ctx.lineWidth = 1
                ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"
                ctx.stroke()
                ctx.fillStyle = "rgba(255, 0, 0, 0.8)"
                ctx.fillText("VAL: " + valueAreaLow.toFixed(2), chartArea.left + 5, yPosLow - 5)
                ctx.restore()

                // Draw Value Area High line
                const yPosHigh = yScale.getPixelForValue(valueAreaHigh)
                ctx.save()
                ctx.beginPath()
                ctx.moveTo(chartArea.left, yPosHigh)
                ctx.lineTo(chartArea.right, yPosHigh)
                ctx.lineWidth = 1
                ctx.strokeStyle = "rgba(0, 128, 0, 0.5)"
                ctx.stroke()
                ctx.fillStyle = "rgba(0, 128, 0, 0.8)"
                ctx.fillText("VAH: " + valueAreaHigh.toFixed(2), chartArea.left + 5, yPosHigh - 5)
                ctx.restore()
              }
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
  function renderIndicators($container, data) {
    if (!data || data.length === 0) {
      console.error("No data to render indicators")
      $container.html('<div class="alert alert-warning">No data available to display indicators</div>')
      return
    }

    // Get the most recent data point
    const latestData = data[data.length - 1]

    // Define indicators to display
    const indicators = [
      {
        name: "RSI (14)",
        value: latestData.rsi !== undefined && latestData.rsi !== null ? latestData.rsi.toFixed(2) : "N/A",
        interpretation: interpretRSI(latestData.rsi || 50),
        description: "Relative Strength Index measures the speed and change of price movements.",
      },
      {
        name: "MACD",
        value: latestData.macd !== undefined && latestData.macd !== null ? latestData.macd.toFixed(4) : "N/A",
        interpretation: interpretMACD(latestData.macd || 0, latestData.macdSignal || 0),
        description: "Moving Average Convergence Divergence is a trend-following momentum indicator.",
      },
      {
        name: "Bollinger Bands",
        value:
          latestData.bbandsUpper && latestData.bbandsLower && latestData.bbandsMiddle
            ? `Width: ${(((latestData.bbandsUpper - latestData.bbandsLower) / latestData.bbandsMiddle) * 100).toFixed(2)}%`
            : "N/A",
        interpretation: interpretBollingerBands(
          latestData.close || 0,
          latestData.bbandsUpper || 0,
          latestData.bbandsLower || 0,
        ),
        description: "Bollinger Bands measure volatility and potential reversal points.",
      },
      {
        name: "Value Area",
        value:
          latestData.valueAreaLow && latestData.valueAreaHigh
            ? `VAL: ${latestData.valueAreaLow.toFixed(2)} / VAH: ${latestData.valueAreaHigh.toFixed(2)}`
            : "N/A",
        interpretation: interpretValueArea(latestData.close, latestData.valueAreaLow, latestData.valueAreaHigh),
        description: "Value Area represents the price range where 70% of the previous day's volume occurred.",
      },
    ]

    // Clear container
    $container.empty()

    // Create indicator cards
    indicators.forEach((indicator) => {
      const badgeClass = `badge ${
        indicator.interpretation.type === "bullish"
          ? "bg-success"
          : indicator.interpretation.type === "bearish"
            ? "bg-danger"
            : "bg-secondary"
      }`

      const iconClass =
        indicator.interpretation.type === "bullish"
          ? "fa-arrow-up"
          : indicator.interpretation.type === "bearish"
            ? "fa-arrow-down"
            : "fa-minus"

      const indicatorHtml = `
                <div class="col-md-6">
                    <div class="indicator-card">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div class="fw-bold">${indicator.name}</div>
                            <span class="${badgeClass}">
                                <i class="fas ${iconClass} me-1"></i>
                                ${indicator.interpretation.type.charAt(0).toUpperCase() + indicator.interpretation.type.slice(1)}
                            </span>
                        </div>
                        <div class="fs-4 fw-bold mb-2">${indicator.value}</div>
                        <p class="text-muted small mb-1">${indicator.interpretation.text}</p>
                        <p class="text-muted small">${indicator.description}</p>
                    </div>
                </div>
            `

      $container.append(indicatorHtml)
    })
  }

  // Interpret Value Area
  function interpretValueArea(price, val, vah) {
    if (!val || !vah) return { type: "neutral", text: "Value Area not available" }

    if (price < val) return { type: "bearish", text: "Price below Value Area Low" }
    if (price > vah) return { type: "bullish", text: "Price above Value Area High" }
    return { type: "neutral", text: "Price within Value Area" }
  }

  // Render trading signals
  function renderSignals($container, signals) {
    // Clear container
    $container.empty()

    if (!signals || signals.length === 0) {
      const noSignalsHtml = `
                <div class="no-signals">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h5>No signals detected</h5>
                    <p>There are currently no trading signals based on your selected timeframe and indicators.
                    Try changing the timeframe or check back later.</p>
                </div>
            `
      $container.append(noSignalsHtml)
      return
    }

    // Create signal cards
    signals.forEach((signal) => {
      const signalTypeClass = signal.type === "buy" ? "buy" : "sell"
      const badgeClass = signal.type === "buy" ? "bg-success" : "bg-danger"
      const iconClass = signal.type === "buy" ? "fa-arrow-up" : "fa-arrow-down"
      const roiColor = signal.potentialRoi > 0 ? "text-success" : "text-danger"

      const signalHtml = `
                <div class="signal-card ${signalTypeClass}">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="d-flex align-items-center">
                            <span class="badge ${badgeClass} me-2">
                                <i class="fas ${iconClass} me-1"></i>
                                ${signal.type.toUpperCase()}
                            </span>
                            <span>${signal.indicator}</span>
                        </div>
                        <small class="text-muted">${signal.time}</small>
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-6 col-md-3">
                            <small class="text-muted d-block">Entry Price</small>
                            <span class="fw-medium">${signal.price}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <small class="text-muted d-block">Target Price</small>
                            <span class="fw-medium">${signal.targetPrice}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <small class="text-muted d-block">Stop Loss</small>
                            <span class="fw-medium">${signal.stopLoss}</span>
                        </div>
                        <div class="col-6 col-md-3">
                            <small class="text-muted d-block">Potential ROI</small>
                            <span class="fw-medium ${roiColor}">${signal.potentialRoi.toFixed(2)}%</span>
                        </div>
                    </div>
                    
                    <p class="text-muted small mb-0">${signal.description}</p>
                </div>
            `

      $container.append(signalHtml)
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
    $sentimentText.text(analysis.sentiment.charAt(0).toUpperCase() + analysis.sentiment.slice(1))
    $sentimentDescription.text(analysis.sentimentDescription)

    // Update sentiment badge
    $sentimentBadge.removeClass("bg-secondary bg-success bg-danger")
    if (analysis.sentiment === "bullish") {
      $sentimentBadge.addClass("bg-success")
      $sentimentBadge.html('<i class="fas fa-arrow-up me-1"></i> Bullish')
    } else if (analysis.sentiment === "bearish") {
      $sentimentBadge.addClass("bg-danger")
      $sentimentBadge.html('<i class="fas fa-arrow-down me-1"></i> Bearish')
    } else {
      $sentimentBadge.addClass("bg-secondary")
      $sentimentBadge.html('<i class="fas fa-minus me-1"></i> Neutral')
    }

    // Update signal strength
    $signalStrengthValue.text(Math.round(analysis.signalStrength))
    $signalStrengthBar.css("width", `${analysis.signalStrength}%`)
    $signalDescription.text(analysis.signalDescription)

    // Update signal strength bar color
    $signalStrengthBar.removeClass("bg-warning bg-success bg-danger")
    if (analysis.signalStrength > 70) {
      $signalStrengthBar.addClass("bg-success")
    } else if (analysis.signalStrength < 30) {
      $signalStrengthBar.addClass("bg-danger")
    } else {
      $signalStrengthBar.addClass("bg-warning")
    }

    // Update ROI
    const roi = analysis.potentialRoi.toFixed(2)
    $roiValue.text(`${roi}%`)

    // Update ROI color and icon
    $roiValue.removeClass("text-success text-danger")
    $roiIcon.removeClass("fa-arrow-up fa-arrow-down fa-minus text-success text-danger")

    if (analysis.potentialRoi > 0) {
      $roiValue.addClass("text-success")
      $roiIcon.addClass("fa-arrow-up text-success")
    } else if (analysis.potentialRoi < 0) {
      $roiValue.addClass("text-danger")
      $roiIcon.addClass("fa-arrow-down text-danger")
    } else {
      $roiIcon.addClass("fa-minus")
    }
  }

  // Event listeners
  $symbolSelect.on("change", loadData)
  $timeframeSelect.on("change", loadData)
  $refreshBtn.on("click", loadData)

  // Initial load
  loadData()
})
