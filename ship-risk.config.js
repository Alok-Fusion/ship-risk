/**
 * ship-risk configuration for this repository
 * @type {import('./src/types').ShipRiskConfig}
 */
module.exports = {
  // Ignore tests and test fixtures during repository scans
  ignore: [
    'test/**',
    '**/*.fixture.*',
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
