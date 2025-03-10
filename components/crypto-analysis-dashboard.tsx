"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react"
import PriceChart from "@/components/price-chart"
import TechnicalIndicators from "@/components/technical-indicators"
import SignalsList from "@/components/signals-list"
import { fetchMarketData, analyzeMarket } from "@/lib/market-analysis"

export default function CryptoAnalysisDashboard() {
  const [timeframe, setTimeframe] = useState("4h")
  const [symbol, setSymbol] = useState("BTCUSDT")
  const [marketData, setMarketData] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [corsError, setCorsError] = useState(false)

  const popularPairs = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "SOLUSDT",
    "DOTUSDT",
    "AVAXUSDT",
    "MATICUSDT",
    "LINKUSDT",
    "UNIUSDT",
  ]

  const timeframes = [
    { value: "5m", label: "5 minutes" },
    { value: "15m", label: "15 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "4h", label: "4 hours" },
    { value: "1d", label: "1 day" },
  ]

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        setCorsError(false)

        // Fetch market data from Binance
        const data = await fetchMarketData(symbol, timeframe)
        setMarketData(data)

        // Analyze the data for signals
        const analysisResult = await analyzeMarket(data)
        setAnalysis(analysisResult)
      } catch (err) {
        console.error("Error loading market data:", err)

        // Check if it's a CORS error
        if (
          err.message &&
          (err.message.includes("CORS") || err.message.includes("cross-origin") || err.message.includes("blocked by"))
        ) {
          setCorsError(true)
          setError("CORS error: Cannot access Binance API directly from browser. Using mock data instead.")
        } else {
          setError("Failed to load market data. Using mock data instead.")
        }

        // Always fall back to mock data
        try {
          const mockData = await fetchMarketData(symbol, timeframe)
          setMarketData(mockData)
          const mockAnalysis = await analyzeMarket(mockData)
          setAnalysis(mockAnalysis)
        } catch (mockErr) {
          setError("Failed to generate mock data. Please try again later.")
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    // Set up polling for regular updates
    const intervalId = setInterval(loadData, 60000) // Update every minute

    return () => clearInterval(intervalId)
  }, [symbol, timeframe])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold">Market Analysis</h2>
          <p className="text-muted-foreground">Analyze cryptocurrency markets for potential trading opportunities</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select pair" />
            </SelectTrigger>
            <SelectContent>
              {popularPairs.map((pair) => (
                <SelectItem key={pair} value={pair}>
                  {pair}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              {timeframes.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {corsError && (
        <Alert className="bg-amber-50 text-amber-800 border-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Due to CORS restrictions, we're using simulated data instead of live Binance data. This is a limitation of
            running on GitHub Pages.
          </AlertDescription>
        </Alert>
      )}

      {error && !corsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading market data...</p>
          </div>
        </div>
      ) : (
        <>
          {analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Market Sentiment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {analysis.sentiment === "bullish" ? (
                      <>
                        <Badge className="bg-green-500">Bullish</Badge>
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      </>
                    ) : analysis.sentiment === "bearish" ? (
                      <>
                        <Badge className="bg-red-500">Bearish</Badge>
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      </>
                    ) : (
                      <Badge>Neutral</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{analysis.sentimentDescription}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Signal Strength</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-secondary rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${
                          analysis.signalStrength > 70
                            ? "bg-green-500"
                            : analysis.signalStrength > 30
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${analysis.signalStrength}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{analysis.signalStrength}%</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{analysis.signalDescription}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Potential ROI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{analysis.potentialRoi.toFixed(2)}%</span>
                    {analysis.potentialRoi > 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Based on current market conditions</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="chart">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chart">Price Chart</TabsTrigger>
              <TabsTrigger value="indicators">Technical Indicators</TabsTrigger>
              <TabsTrigger value="signals">Trading Signals</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Price Chart</CardTitle>
                  <CardDescription>{symbol} price chart with key support and resistance levels</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">{marketData && <PriceChart data={marketData} />}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="indicators" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Technical Indicators</CardTitle>
                  <CardDescription>Key technical indicators and their current values</CardDescription>
                </CardHeader>
                <CardContent>{marketData && <TechnicalIndicators data={marketData} />}</CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signals" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Trading Signals</CardTitle>
                  <CardDescription>Recent buy and sell signals based on technical analysis</CardDescription>
                </CardHeader>
                <CardContent>{analysis && <SignalsList signals={analysis.signals} />}</CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-center p-4 bg-muted rounded-lg">
            <InfoIcon className="h-5 w-5 mr-2 text-blue-500" />
            <p className="text-sm">
              {corsError
                ? "This analysis is based on simulated data for demonstration purposes. In a production environment, you would connect to real market data."
                : "This analysis is based on technical indicators and historical patterns. Always combine with fundamental analysis and risk management for better results."}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

