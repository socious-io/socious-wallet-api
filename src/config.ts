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
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  },
  kyc: {
    endpoint: process.env.KYC_API_ENDPOINT as string,
    apikey: process.env.KYC_API_KEY as string,
    secret: process.env.KYC_API_SECRET_KEY as string,
  },
  agent: {
    endpoint: process.env.AGENT_ENDPOINT as string,
    trust_did: process.env.AGENT_TRUST_DID as string,
  },
  wallet: {
    connect_address: 'https://wallet.socious.io/connect',
    callback: (process.env.WALLET_CALLBACK_URL as string) || 'https://wallet-api.socious.io/verify/claims',
  },
};
