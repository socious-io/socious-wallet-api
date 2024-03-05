import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { Readable } from 'stream';
import { config } from './config';
import axios from 'axios';
import crypto from 'crypto';

const s3 = new S3Client(config.aws);

export const upload = multer({
  storage: multerS3({
    s3,
    bucket: config.bucket as string,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, file.originalname);
    },
  }),
});

export const fetch = async (filename: string): Promise<Buffer> => {
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: filename,
  });
  const { Body } = await s3.send(command);

  if (Body instanceof Readable) {
    // Convert the stream to a Buffer
    return await streamToBuffer(Body);
  } else {
    throw new Error('Expected a stream for S3 object body.');
  }
};

// Helper function to convert a stream to a Buffer
const streamToBuffer = (stream: Readable): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
};

export async function sendCredentials({ connectionId, claims }: { connectionId: string; claims: any }) {
  const payload = {
    claims,
    connectionId,
    issuingDID: config.agent.trust_did,
    schemaId: null,
    automaticIssuance: true,
  };
  const res = await axios.post(`${config.agent.endpoint}/prism-agent/issue-credentials/credential-offers`, payload);
  return res.data;
}

export async function createConnection() {
  const { data } = await axios.post(`${config.agent.endpoint}/prism-agent/connections`, {
    label: 'Wallet Verify Connection',
  });
  const id = data.connectionId;
  let url = data.invitation.invitationUrl;
  url = url.replace('https://my.domain.com/path', config.wallet.connect_address);
  url += `&callback=${config.wallet.callback}/${id}`;
  return { id, url };
}

export async function getVerifyStatus(session: string) {
  try {
    const url = `${config.kyc.endpoint}/v1/sessions/${session}/decision`;
    const headers = {
      'X-AUTH-CLIENT': config.kyc.apikey,
      'X-HMAC-SIGNATURE': generateSignature(session),
    };
    return axios.get(url, { headers });
  } catch (err) {
    console.log(err);
    await timeout(1000);
    return getVerifyStatus(session);
  }
}

export function generateSignature(payload: any) {
  const secret = config.kyc.secret;
  if (payload.constructor === Object) {
    payload = JSON.stringify(payload);
  }

  if (payload.constructor !== Buffer) {
    payload = Buffer.from(payload, 'utf8');
  }

  const signature = crypto.createHmac('sha256', secret);
  signature.update(payload);
  return signature.digest('hex');
}

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
