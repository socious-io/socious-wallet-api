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
};
