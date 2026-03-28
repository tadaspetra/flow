import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function getScribeToken(): Promise<string> {
  const apiKey = getRequiredEnv('ELEVENLABS_API_KEY');
  const client = new ElevenLabsClient({ apiKey });
  const response = await client.tokens.singleUse.create('realtime_scribe');
  return response.token;
}
