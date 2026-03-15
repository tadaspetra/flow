function getRequiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getScribeToken() {
  const apiKey = getRequiredEnv('ELEVENLABS_API_KEY');
  const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js');
  const client = new ElevenLabsClient({ apiKey });
  const response = await client.tokens.singleUse.create('realtime_scribe');
  return response.token;
}

module.exports = {
  getRequiredEnv,
  getScribeToken
};
