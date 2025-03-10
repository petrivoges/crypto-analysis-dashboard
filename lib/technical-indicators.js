// This file implements technical indicators calculations

// Calculate Relative Strength Index (RSI)
export function calculateRSI(prices, period = 14) {
  const gains = []
  const losses = []

  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) {
      gains.push(change)
      losses.push(0)
    } else {
      gains.push(0)
      losses.push(Math.abs(change))
    }
  }

  const avgGains = calculateSMA(gains, period)
  const avgLosses = calculateSMA(losses, period)

  const rsiValues = []
  for (let i = 0; i < prices.length; i++) {
    if (i < period) {
      rsiValues.push(50) // Initial value
    } else {
      const rs = avgLosses[i - period] === 0 ? 100 : avgGains[i - period] / avgLosses[i - period]
      const rsi = 100 - 100 / (1 + rs)
      rsiValues.push(rsi)
    }
  }

  return rsiValues
}

// Calculate Moving Average Convergence Divergence (MACD)
export function calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(prices, fastPeriod)
  const emaSlow = calculateEMA(prices, slowPeriod)

  const macdLine = []
  for (let i = 0; i < prices.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i])
  }

  const signalLine = calculateEMA(macdLine, signalPeriod)

  const histogram = []
  for (let i = 0; i < prices.length; i++) {
    histogram.push(macdLine[i] - signalLine[i])
  }

  return { macdLine, signalLine, histogram }
}

// Calculate Bollinger Bands
export function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  const sma = calculateSMA(prices, period)

  const upperBand = []
  const lowerBand = []

  for (let i = 0; i < prices.length; i++) {
    const std = calculateStandardDeviation(prices.slice(Math.max(0, i - period + 1), i + 1))
    upperBand.push(sma[i] + stdDev * std)
    lowerBand.push(sma[i] - stdDev * std)
  }

  return { upper: upperBand, middle: sma, lower: lowerBand }
}

// Calculate Stochastic Oscillator
export function calculateStochastic(highs, lows, closes, period = 14, smoothingPeriod = 3) {
  const kValues = []

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      kValues.push(50) // Initial value
    } else {
      const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1))
      const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1))
      const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      kValues.push(k)
    }
  }

  const dValues = calculateSMA(kValues, smoothingPeriod)

  return { k: kValues, d: dValues }
}

// Calculate Simple Moving Average (SMA)
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

// Calculate Exponential Moving Average (EMA)
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
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + emaData[i - 1] * (1 - k)
    emaData.push(ema)
  }

  // Pad the beginning with null values if needed
  if (emaData.length < data.length) {
    const padding = Array(data.length - emaData.length).fill(null)
    return [...padding, ...emaData]
  }

  return emaData
}

// Calculate Standard Deviation
function calculateStandardDeviation(data) {
  if (data.length === 0) return 0
  const avg = data.reduce((sum, value) => sum + value, 0) / data.length
  const squareDiffs = data.map((value) => Math.pow(value - avg, 2))
  const avgSquareDiff = squareDiffs.reduce((sum, value) => sum + value, 0) / data.length
  return Math.sqrt(avgSquareDiff)
}

