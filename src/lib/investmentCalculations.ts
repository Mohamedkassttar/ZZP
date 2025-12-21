export function calculateKIA(totalInvestmentAmount: number, year: number = 2024): number {
  if (totalInvestmentAmount < 2800) {
    return 0;
  }

  if (totalInvestmentAmount >= 2800 && totalInvestmentAmount <= 63000) {
    return Math.round(totalInvestmentAmount * 0.28 * 100) / 100;
  }

  return 17000;
}

export function getKIAThresholds(year: number = 2024) {
  return {
    minimumInvestment: 2800,
    maximumForPercentage: 63000,
    percentage: 0.28,
    maximumDeduction: 17000,
  };
}
