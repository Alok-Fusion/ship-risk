// Safe secrets fixture
require('dotenv').config();

const openaiApiKey = process.env.OPENAI_API_KEY;
const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const dbUri = process.env.DATABASE_URL;

const config = {
  apiKey: process.env.SERVICE_API_KEY,
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development'
};

module.exports = { config, dbUri, openaiApiKey, awsAccessKey };
