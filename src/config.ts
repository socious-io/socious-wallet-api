import 'dotenv/config';

export const config = {
  http: {
    port: process.env.HTTP_PORT || 3000,
    origin: process.env.HTTP_ORIGIN?.split(',') || [],
  },
  apikey: process.env.API_KEY,
  s3: {
    bucket: process.env.S3_BUCKET as string,
    endpoint: process.env.S3_ENDPOINT as string,
    region: process.env.S3_REGION || 'us-ashburn-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
  },
  kyc: {
    endpoint: process.env.KYC_API_ENDPOINT as string,
    apikey: process.env.KYC_API_KEY as string,
    secret: process.env.KYC_API_SECRET_KEY as string,
    callback: process.env.KYC_API_CALLBACK_URL as string || 'https://wallet-api.socious.io/verify/complete',
  },
  agent: {
    endpoint: process.env.AGENT_ENDPOINT as string,
    trust_did: process.env.AGENT_TRUST_DID as string,
    agent_api_key: process.env.AGENT_API_KEY as string,
    credential_schema_id: process.env.AGENT_CREDENTIAL_SCHEMA_ID || '07cfc621-0d0b-3afd-a59e-6bc23f606cb5',
  },
  wallet: {
    connect_address: 'https://wallet.socious.io/connect',
    callback: (process.env.WALLET_CALLBACK_URL as string) || 'https://wallet-api.socious.io/verify/claims',
  },
};
