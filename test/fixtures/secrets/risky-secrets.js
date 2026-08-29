// Risky secrets fixture
const openaiApiKey = "sk-proj-abc1234567890defghijklmnopqrstuvwxyz123456";
const awsAccessKey = "AKIAIOSFODNN7EXAMPLE";
const slackToken = "xoxb-mockslacktoken123456789abcdef";
const stripeLiveKey = "sk_test_51AbcDefGhIjKlMnOpQrStUvWxYz";
const dbUri = "postgres://admin:SuperSecretP@ssw0rd123!@db.internal:5432/prod";

const config = {
  apiKey: "d8f43a9b8e2c71f05423bc89a712e098",
  password: "super_insecure_hardcoded_password_123",
  secret: "shhh_do_not_share_this_production_jwt_secret"
};

// Direct import of .env
const env = require('./.env');
const dbHost = env.DB_HOST_PROD;

module.exports = { config, dbHost };
