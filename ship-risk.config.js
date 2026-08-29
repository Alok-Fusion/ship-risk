/**
 * ship-risk configuration for this repository
 * @type {import('./src/types').ShipRiskConfig}
 */
module.exports = {
  // Only ignore test fixtures (which contain intentionally vulnerable code)
  ignore: [
    '**/fixtures/**',
    'dist/**',
    'coverage/**',
  ],

  weights: {
    secrets: 25,
    auth: 25,
    validation: 20,
    errorHandling: 10,
    testing: 10,
    reliability: 10,
  },

  options: {
    minScore: 70,
  },
};
