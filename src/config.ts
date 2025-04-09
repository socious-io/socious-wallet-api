import 'dotenv/config';

export const config = {
  http: {
    port: process.env.HTTP_PORT || 3000,
    origin: process.env.HTTP_ORIGIN?.split(',') || [],
  },
  apikey: process.env.API_KEY,
  bucket: process.env.AWS_BUCKET,
  aws: {
    region: process.env.AWS_DEFAULT_REGION as string,
    httpOptions: {
      timeout: 5 * 60 * 1000, // 5 minutes timeout for S3 operations
    },
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  },
  kyc: {
    endpoint: process.env.KYC_API_ENDPOINT as string,
    apikey: process.env.KYC_API_KEY as string,
    secret: process.env.KYC_API_SECRET_KEY as string,
    callback: process.env.KYC_API_CALLBACK_URL as string || 'https://wallet.socious.io/verify',
  },
  agent: {
    endpoint: process.env.AGENT_ENDPOINT as string,
    trust_did: process.env.AGENT_TRUST_DID as string,
    agent_api_key: process.env.AGENT_API_KEY as string,
  },
  wallet: {
    connect_address: 'https://wallet.socious.io/connect',
    callback: (process.env.WALLET_CALLBACK_URL as string) || 'https://wallet-api.socious.io/verify/claims',
  },

  gcs: {
    credntialsFile: process.env.GCS_CREDENTIALS_FILE as string,
    bucket: process.env.GCS_BUCKET as string
  }

};
