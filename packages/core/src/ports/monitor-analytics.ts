export interface MonitorAnalytics {
  calculate(returns: number[]): {
    valueAtRisk: number;
    maximumDrawdown: number;
    drawdowns: number[];
  };
}
