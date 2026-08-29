/**
 * ship-risk configuration for this repository
 * @type {import('./src/types').ShipRiskConfig}
 */
module.exports = {
  ignore: [
    'test/fixtures/**', // only the fixtures, not the real tests
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
