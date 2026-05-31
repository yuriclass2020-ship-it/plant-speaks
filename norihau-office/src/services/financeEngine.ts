import type { ProductionEstimate, Subscription } from "../types";

export function getMonthlyOperatingCost(subscriptions: Subscription[]) {
  return subscriptions.reduce((sum, item) => sum + item.monthlyCost, 0);
}

export function calculateProductionCost(estimate: ProductionEstimate) {
  const totalHours =
    estimate.planningHours + estimate.designHours + estimate.developmentHours + estimate.marketingHours;

  return {
    totalHours,
    totalCost: totalHours * estimate.hourlyRate,
  };
}
