// This file implements market analysis functions with client-side data fetching

import { calculateRSI, calculateMACD, calculateBollingerBands, calculateStochastic } from "./technical-indicators"

// Fetch market data from Binance (client-side compatible)
export async function fetchMarketData(symbol, timeframe) {
  try {
    // For GitHub Pages, we need to use CORS proxies or public APIs
    // Option 1: Use a CORS proxy (not recommended for production)
    // const corsProxy = 'https://cors-anywhere.herokuapp.com/'

    // Option 2: Use Binance public API with proper headers (works in browsers)
    const interval = convertTimeframeFormat(timeframe)

    // Use the public API endpoint
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform Binance data to our format
    const formattedData = data.map((candle) => ({
      time: candle[0], // Open time
      open: Number.parseFloat(candle[1]),
      high: Number.parseFloat(candle[2]),
      low: Number.parseFloat(candle[3]),
      close: Number.parseFloat(candle[4]),
      volume: Number.parseFloat(candle[5]),
    }))

    // Calculate additional indicators
    return enrichDataWithIndicators(formattedData)
  } catch (error) {
    console.error("Error fetching market data:", error)

    // Fallback to mock data if API fails
    console.log("Falling back to mock data")
    return generateMockData(symbol, timeframe)
  }
}

// Convert our timeframe format to Binance format
function convertTimeframeFormat(timeframe) {
  switch (timeframe) {
    case "1m":
      return "1m"
    case "5m":
      return "5m"
    case "15m":
      return "15m"
    case "30m":
      return "30m"
    case "1h":
      return "1h"
    case "4h":
      return "4h"
    case "1d":
      return "1d"
    default:
      return "1h"
  }
}

// Enrich raw price data with technical indicators
function enrichDataWithIndicators(data) {
  const closes = data.map((d) => d.close)
  const highs = data.map((d) => d.high)
  const lows = data.map((d) => d.low)

  // Calculate EMAs
  const ema20 = calculateEMA(closes, 20)
  const ema50 = calculateEMA(closes, 50)

  // Calculate RSI
  const rsiValues = calculateRSI(closes, 14)

  // Calculate MACD
  const macdResult = calculateMACD(closes)

  // Calculate Bollinger Bands
  const bbandsResult = calculateBollingerBands(closes, 20, 2)

  // Calculate Stochastic
  const stochResult = calculateStochastic(highs, lows, closes, 14, 3)

  // Calculate ADX
  const adxValues = calculateADX(highs, lows, closes, 14)

  // Calculate OBV
  const obvValues = calculateOBV(
    closes,
    data.map((d) => d.volume),
  )

  // Calculate Ichimoku Cloud
  const ichimokuResult = calculateIchimoku(highs, lows, closes)

  // Calculate Fibonacci levels
  const highestHigh = Math.max(...highs)
  const lowestLow = Math.min(...lows)
  const range = highestHigh - lowestLow

  const fibLevels = [
    { level: "0.0", value: lowestLow },
    { level: "0.236", value: lowestLow + range * 0.236 },
    { level: "0.382", value: lowestLow + range * 0.382 },
    { level: "0.5", value: lowestLow + range * 0.5 },
    { level: "0.618", value: lowestLow + range * 0.618 },
    { level: "0.786", value: lowestLow + range * 0.786 },
    { level: "1.0", value: highestHigh },
  ]

  // Calculate support and resistance levels
  const supportResistanceLevels = findSupportResistanceLevels(data)

  // Combine all data
  return data.map((item, i) => ({
    ...item,
    ema20: ema20[i],
    ema50: ema50[i],
    rsi: rsiValues[i] || 50,
    macd: macdResult.macdLine[i] || 0,
    macdSignal: macdResult.signalLine[i] || 0,
    macdHistogram: macdResult.histogram[i] || 0,
    bbandsUpper: bbandsResult.upper[i] || item.close * 1.02,
    bbandsMiddle: bbandsResult.middle[i] || item.close,
    bbandsLower: bbandsResult.lower[i] || item.close * 0.98,
    bbandsWidth: bbandsResult.upper[i]
      ? ((bbandsResult.upper[i] - bbandsResult.lower[i]) / bbandsResult.middle[i]) * 100
      : 4,
    stochK: stochResult.k[i] || 50,
    stochD: stochResult.d[i] || 50,
    adx: adxValues[i] || 25,
    obv: obvValues[i] || 0,
    tenkan: ichimokuResult.tenkan[i] || item.close,
    kijun: ichimokuResult.kijun[i] || item.close,
    senkou_a: ichimokuResult.senkou_a[i] || item.close,
    senkou_b: ichimokuResult.senkou_b[i] || item.close,
    fibLevels,
    supportLevels: supportResistanceLevels.support,
    resistanceLevels: supportResistanceLevels.resistance,
  }))
}

// Analyze market data for trading signals
export async function analyzeMarket(data) {
  if (!data || data.length === 0) {
    throw new Error("No data to analyze")
  }

  // Calculate various technical indicators
  const rsi = data.map((d) => d.rsi)
  const macd = {
    macdLine: data.map((d) => d.macd),
    signalLine: data.map((d) => d.macdSignal),
    histogram: data.map((d) => d.macdHistogram),
  }
  const bbands = {
    upper: data.map((d) => d.bbandsUpper),
    middle: data.map((d) => d.bbandsMiddle),
    lower: data.map((d) => d.bbandsLower),
  }
  const stoch = {
    k: data.map((d) => d.stochK),
    d: data.map((d) => d.stochD),
  }

  // Determine market sentiment
  const latestClose = data[data.length - 1].close
  const ema20 = data[data.length - 1].ema20
  const ema50 = data[data.length - 1].ema50
  const latestRSI = rsi[rsi.length - 1]
  const latestMACD = macd.macdLine[macd.macdLine.length - 1]
  const latestSignal = macd.signalLine[macd.signalLine.length - 1]

  let sentiment = "neutral"
  let sentimentDescription = ""

  if (latestClose > ema20 && ema20 > ema50 && latestRSI > 50 && latestMACD > latestSignal) {
    sentiment = "bullish"
    sentimentDescription =
      "Multiple indicators suggest a bullish trend. Price is above key moving averages with positive momentum."
  } else if (latestClose < ema20 && ema20 < ema50 && latestRSI < 50 && latestMACD < latestSignal) {
    sentiment = "bearish"
    sentimentDescription =
      "Multiple indicators suggest a bearish trend. Price is below key moving averages with negative momentum."
  } else {
    sentimentDescription = "Mixed signals from different indicators. The market appears to be in a consolidation phase."
  }

  // Generate trading signals
  const signals = generateSignals(data, rsi, macd, bbands, stoch)

  // Calculate signal strength (0-100)
  const signalStrength = calculateSignalStrength(data, rsi, macd, bbands, stoch)

  // Determine potential ROI based on recent price action and volatility
  const potentialRoi = calculatePotentialRoi(data, sentiment)

  // Signal description based on strength
  let signalDescription = ""
  if (signalStrength > 70) {
    signalDescription = "Strong confluence of multiple indicators suggesting high probability setup."
  } else if (signalStrength > 50) {
    signalDescription = "Moderate signal strength with some confirming indicators."
  } else {
    signalDescription = "Weak signal strength. Consider waiting for more confirmation."
  }

  return {
    sentiment,
    sentimentDescription,
    signalStrength,
    signalDescription,
    potentialRoi,
    signals,
  }
}

// Generate mock market data for demonstration
function generateMockData(symbol, timeframe) {
  const data = []
  const periods = 100
  const basePrice = symbol.includes("BTC") ? 65000 : symbol.includes("ETH") ? 3500 : 300
  let price = basePrice
  const volatility = basePrice * 0.02 // 2% volatility

  const now = new Date()
  let time = new Date(now)

  // Adjust time based on timeframe
  const timeframeMinutes = timeframeToMinutes(timeframe)
  time.setMinutes(time.getMinutes() - periods * timeframeMinutes)

  for (let i = 0; i < periods; i++) {
    const open = price
    const high = open + Math.random() * volatility
    const low = open - Math.random() * volatility
    const close = low + Math.random() * (high - low)
    const volume = Math.random() * 1000000 + 500000

    time = new Date(time.getTime() + timeframeMinutes * 60 * 1000)

    data.push({
      time: time.getTime(),
      open,
      high,
      low,
      close,
      volume,
    })

    price = close
  }

  return enrichDataWithIndicators(data)
}

// Helper function to convert timeframe to minutes
function timeframeToMinutes(timeframe) {
  switch (timeframe) {
    case "1m":
      return 1
    case "5m":
      return 5
    case "15m":
      return 15
    case "30m":
      return 30
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

// Calculate EMA
function calculateEMA(data, period) {
  const k = 2 / (period + 1)
  const emaData = []

  // Calculate SMA for the first period
  let sum = 0
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i]
  }
  let ema = sum / Math.min(period, data.length)
  emaData.push(ema)

  // Calculate EMA for the rest of the data
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k)
    emaData.push(ema)
  }

  // Pad the beginning with null values if needed
  if (emaData.length < data.length) {
    const padding = Array(data.length - emaData.length).fill(null)
    return [...padding, ...emaData]
  }

  return emaData
}

// Calculate average
function calculateAverage(data) {
  if (data.length === 0) return 0
  return data.reduce((sum, value) => sum + value, 0) / data.length
}

// Generate trading signals based on technical indicators
function generateSignals(data, rsi, macd, bbands, stoch) {
  const signals = []
  const latestData = data[data.length - 1]
  const previousData = data[data.length - 2]

  // RSI signals
  if (rsi[rsi.length - 2] < 30 && rsi[rsi.length - 1] > 30) {
    signals.push({
      type: "buy",
      time: latestData.time,
      price: latestData.close,
      indicator: "RSI",
      strength: 75,
      description: "RSI crossed above 30, indicating a potential reversal from oversold conditions.",
      targetPrice: latestData.close * 1.03, // 3% target
      stopLoss: latestData.close * 0.98, // 2% stop loss
      potentialRoi: 3,
    })
  }

  if (rsi[rsi.length - 2] > 70 && rsi[rsi.length - 1] < 70) {
    signals.push({
      type: "sell",
      time: latestData.time,
      price: latestData.close,
      indicator: "RSI",
      strength: 75,
      description: "RSI crossed below 70, indicating a potential reversal from overbought conditions.",
      targetPrice: latestData.close * 0.97, // 3% target
      stopLoss: latestData.close * 1.02, // 2% stop loss
      potentialRoi: 3,
    })
  }

  // MACD signals
  if (
    macd.macdLine[macd.macdLine.length - 2] < macd.signalLine[macd.signalLine.length - 2] &&
    macd.macdLine[macd.macdLine.length - 1] > macd.signalLine[macd.signalLine.length - 1]
  ) {
    signals.push({
      type: "buy",
      time: latestData.time,
      price: latestData.close,
      indicator: "MACD",
      strength: 65,
      description: "MACD line crossed above signal line, indicating bullish momentum.",
      targetPrice: latestData.close * 1.025, // 2.5% target
      stopLoss: latestData.close * 0.985, // 1.5% stop loss
      potentialRoi: 2.5,
    })
  }

  if (
    macd.macdLine[macd.macdLine.length - 2] > macd.signalLine[macd.signalLine.length - 2] &&
    macd.macdLine[macd.macdLine.length - 1] < macd.signalLine[macd.signalLine.length - 1]
  ) {
    signals.push({
      type: "sell",
      time: latestData.time,
      price: latestData.close,
      indicator: "MACD",
      strength: 65,
      description: "MACD line crossed below signal line, indicating bearish momentum.",
      targetPrice: latestData.close * 0.975, // 2.5% target
      stopLoss: latestData.close * 1.015, // 1.5% stop loss
      potentialRoi: 2.5,
    })
  }

  // Bollinger Bands signals
  if (
    previousData.close < bbands.lower[bbands.lower.length - 2] &&
    latestData.close > bbands.lower[bbands.lower.length - 1]
  ) {
    signals.push({
      type: "buy",
      time: latestData.time,
      price: latestData.close,
      indicator: "Bollinger Bands",
      strength: 70,
      description: "Price bounced off the lower Bollinger Band, indicating potential reversal.",
      targetPrice: bbands.middle[bbands.middle.length - 1], // Target middle band
      stopLoss: bbands.lower[bbands.lower.length - 1] * 0.99, // Stop below lower band
      potentialRoi: (bbands.middle[bbands.middle.length - 1] / latestData.close - 1) * 100,
    })
  }

  if (
    previousData.close > bbands.upper[bbands.upper.length - 2] &&
    latestData.close < bbands.upper[bbands.upper.length - 1]
  ) {
    signals.push({
      type: "sell",
      time: latestData.time,
      price: latestData.close,
      indicator: "Bollinger Bands",
      strength: 70,
      description: "Price rejected at the upper Bollinger Band, indicating potential reversal.",
      targetPrice: bbands.middle[bbands.middle.length - 1], // Target middle band
      stopLoss: bbands.upper[bbands.upper.length - 1] * 1.01, // Stop above upper band
      potentialRoi: (1 - bbands.middle[bbands.middle.length - 1] / latestData.close) * 100,
    })
  }

  // EMA crossover signals
  if (previousData.ema20 < previousData.ema50 && latestData.ema20 > latestData.ema50) {
    signals.push({
      type: "buy",
      time: latestData.time,
      price: latestData.close,
      indicator: "EMA Crossover",
      strength: 80,
      description: "EMA 20 crossed above EMA 50, indicating a bullish trend change.",
      targetPrice: latestData.close * 1.03, // 3% target
      stopLoss: latestData.close * 0.98, // 2% stop loss
      potentialRoi: 3,
    })
  }

  if (previousData.ema20 > previousData.ema50 && latestData.ema20 < latestData.ema50) {
    signals.push({
      type: "sell",
      time: latestData.time,
      price: latestData.close,
      indicator: "EMA Crossover",
      strength: 80,
      description: "EMA 20 crossed below EMA 50, indicating a bearish trend change.",
      targetPrice: latestData.close * 0.97, // 3% target
      stopLoss: latestData.close * 1.02, // 2% stop loss
      potentialRoi: 3,
    })
  }

  return signals
}

// Calculate overall signal strength based on multiple indicators
function calculateSignalStrength(data, rsi, macd, bbands, stoch) {
  let strength = 50 // Start with neutral
  const latestData = data[data.length - 1]
  const latestRSI = rsi[rsi.length - 1]
  const latestMACD = macd.macdLine[macd.macdLine.length - 1]
  const latestSignal = macd.signalLine[macd.signalLine.length - 1]

  // Trend analysis
  if (latestData.close > latestData.ema20 && latestData.ema20 > latestData.ema50) {
    strength += 10 // Strong uptrend
  } else if (latestData.close < latestData.ema20 && latestData.ema20 < latestData.ema50) {
    strength -= 10 // Strong downtrend
  }

  // RSI analysis
  if (latestRSI > 70) {
    strength -= 5 // Overbought
  } else if (latestRSI < 30) {
    strength += 5 // Oversold
  }

  // MACD analysis
  if (latestMACD > latestSignal && latestMACD > 0) {
    strength += 7 // Strong bullish
  } else if (latestMACD < latestSignal && latestMACD < 0) {
    strength -= 7 // Strong bearish
  }

  // Volatility analysis
  const bbandsWidth =
    ((bbands.upper[bbands.upper.length - 1] - bbands.lower[bbands.lower.length - 1]) /
      bbands.middle[bbands.middle.length - 1]) *
    100

  if (bbandsWidth < 10) {
    strength -= 5 // Low volatility, weaker signals
  } else if (bbandsWidth > 30) {
    strength += 5 // High volatility, stronger signals
  }

  // Ensure strength is between 0 and 100
  return Math.max(0, Math.min(100, strength))
}

// Calculate potential ROI based on market conditions
function calculatePotentialRoi(data, sentiment) {
  const latestData = data[data.length - 1]

  // Calculate average true range (ATR) as a measure of volatility
  const atr = calculateATR(data, 14)
  const latestATR = atr[atr.length - 1]

  // Calculate potential ROI based on volatility and sentiment
  const volatilityFactor = (latestATR / latestData.close) * 100

  let potentialRoi = 0

  if (sentiment === "bullish") {
    potentialRoi = 2 + volatilityFactor * 0.5 // Base 2% plus volatility adjustment
  } else if (sentiment === "bearish") {
    potentialRoi = -2 - volatilityFactor * 0.5 // Base -2% plus volatility adjustment
  } else {
    potentialRoi = volatilityFactor * 0.3 // Neutral sentiment, smaller potential
  }

  // Limit ROI to reasonable range
  return Math.max(-5, Math.min(5, potentialRoi))
}

// Calculate Average True Range (ATR)
function calculateATR(data, period) {
  const trueRanges = []

  // Calculate true ranges
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high
    const low = data[i].low
    const prevClose = data[i - 1].close

    const tr1 = high - low
    const tr2 = Math.abs(high - prevClose)
    const tr3 = Math.abs(low - prevClose)

    const trueRange = Math.max(tr1, tr2, tr3)
    trueRanges.push(trueRange)
  }

  // Calculate ATR using simple moving average
  const atr = []
  for (let i = 0; i < trueRanges.length - period + 1; i++) {
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += trueRanges[i + j]
    }
    atr.push(sum / period)
  }

  // Pad the beginning with null values
  const padding = Array(data.length - atr.length).fill(null)
  return [...padding, ...atr]
}

// Calculate On-Balance Volume (OBV)
function calculateOBV(closes, volumes) {
  const obv = [volumes[0]]

  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) {
      obv.push(obv[i - 1] + volumes[i])
    } else if (closes[i] < closes[i - 1]) {
      obv.push(obv[i - 1] - volumes[i])
    } else {
      obv.push(obv[i - 1])
    }
  }

  return obv
}

// Calculate Average Directional Index (ADX)
function calculateADX(highs, lows, closes, period) {
  // This is a simplified ADX calculation
  const adx = []

  // For simplicity, we'll generate values between 10-40
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      adx.push(null)
    } else {
      // Trend strength increases if price is trending
      const trendStrength = (Math.abs(closes[i] - closes[i - period]) / closes[i - period]) * 100
      adx.push(Math.min(60, 10 + trendStrength * 5))
    }
  }

  return adx
}

// Calculate Ichimoku Cloud
function calculateIchimoku(highs, lows, closes) {
  const tenkan = []
  const kijun = []
  const senkou_a = []
  const senkou_b = []

  for (let i = 0; i < closes.length; i++) {
    // Tenkan-sen (Conversion Line): (9-period high + 9-period low)/2
    if (i >= 8) {
      const highestHigh = Math.max(...highs.slice(i - 8, i + 1))
      const lowestLow = Math.min(...lows.slice(i - 8, i + 1))
      tenkan.push((highestHigh + lowestLow) / 2)
    } else {
      tenkan.push(null)
    }

    // Kijun-sen (Base Line): (26-period high + 26-period low)/2
    if (i >= 25) {
      const highestHigh = Math.max(...highs.slice(i - 25, i + 1))
      const lowestLow = Math.min(...lows.slice(i - 25, i + 1))
      kijun.push((highestHigh + lowestLow) / 2)
    } else {
      kijun.push(null)
    }

    // Senkou Span A (Leading Span A): (Conversion Line + Base Line)/2
    if (i >= 25) {
      senkou_a.push((tenkan[i] + kijun[i]) / 2)
    } else {
      senkou_a.push(null)
    }

    // Senkou Span B (Leading Span B): (52-period high + 52-period low)/2
    if (i >= 51) {
      const highestHigh = Math.max(...highs.slice(i - 51, i + 1))
      const lowestLow = Math.min(...lows.slice(i - 51, i + 1))
      senkou_b.push((highestHigh + lowestLow) / 2)
    } else {
      senkou_b.push(null)
    }
  }

  return { tenkan, kijun, senkou_a, senkou_b }
}

// Find support and resistance levels
function findSupportResistanceLevels(data) {
  const closes = data.map((d) => d.close)
  const highs = data.map((d) => d.high)
  const lows = data.map((d) => d.low)

  // Find local minima and maxima
  const localMinima = []
  const localMaxima = []

  for (let i = 5; i < data.length - 5; i++) {
    // Check for local minimum
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      localMinima.push(lows[i])
    }

    // Check for local maximum
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      localMaxima.push(highs[i])
    }
  }

  // Group similar levels
  const supportLevels = groupSimilarLevels(localMinima)
  const resistanceLevels = groupSimilarLevels(localMaxima)

  // If we don't have enough levels, add some based on recent price action
  if (supportLevels.length < 3) {
    const currentPrice = closes[closes.length - 1]
    supportLevels.push(currentPrice * 0.98)
    supportLevels.push(currentPrice * 0.95)
    supportLevels.push(currentPrice * 0.93)
  }

  if (resistanceLevels.length < 3) {
    const currentPrice = closes[closes.length - 1]
    resistanceLevels.push(currentPrice * 1.02)
    resistanceLevels.push(currentPrice * 1.05)
    resistanceLevels.push(currentPrice * 1.07)
  }

  return {
    support: supportLevels.slice(0, 3), // Return top 3 support levels
    resistance: resistanceLevels.slice(0, 3), // Return top 3 resistance levels
  }
}

// Group similar price levels
function groupSimilarLevels(levels) {
  if (levels.length === 0) return []

  // Sort levels
  levels.sort((a, b) => a - b)

  const groupedLevels = []
  let currentGroup = [levels[0]]

  for (let i = 1; i < levels.length; i++) {
    // If this level is within 0.5% of the previous one, group them
    if ((levels[i] - levels[i - 1]) / levels[i - 1] < 0.005) {
      currentGroup.push(levels[i])
    } else {
      // Calculate average of current group
      const avg = currentGroup.reduce((sum, val) => sum + val, 0) / currentGroup.length
      groupedLevels.push(avg)

      // Start a new group
      currentGroup = [levels[i]]
    }
  }

  // Add the last group
  if (currentGroup.length > 0) {
    const avg = currentGroup.reduce((sum, val) => sum + val, 0) / currentGroup.length
    groupedLevels.push(avg)
  }

  return groupedLevels
}

