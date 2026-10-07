// Bot policy and runner limits, separate from encounter balance.
export const SIMULATION_RULES = {
  maxTicks: 18000,
  dangerMarginMeters: 1,
  rangedDistanceMeters: 15,
  rangedToleranceMeters: 1,
  remedyHealthRatio: 0.9,
  greatRemedyHealthRatio: 0.5,
  offeringHealthRatio: 0.7,
  offeringMinAllies: 2,
} as const;
