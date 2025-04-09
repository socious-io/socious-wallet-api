import { Storage } from '@google-cloud/storage';
import multer from 'multer';
import { Readable } from 'stream';
import { config } from './config';
import axios from 'axios';
import crypto from 'crypto';


const gcp = new Storage({
  keyFilename: config.gcs.credntialsFile
})

const bucket = gcp.bucket(config.gcs.bucket);

const diditToken = {
  access_token: undefined,
  expire_at: new Date(),
};

export const upload = multer({
  storage: {
    _handleFile: (req, file, cb) => {
      const blob = bucket.file(file.originalname);
      const blobStream = blob.createWriteStream();

      file.stream.pipe(blobStream)
        .on('error', (err) => cb(err))
        .on('finish', () => {
          cb(null, {
            path: `https://storage.googleapis.com/${bucket.name}/${blob.name}`,
            filename: blob.name
          });
        });
    },
    _removeFile: (req, file, cb) => {
      bucket.file(file.filename).delete().then(() => cb(null)).catch(cb);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const cloudAgentHeaders = {
  apikey: config.agent.agent_api_key,
};

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
  const res = await axios.post(`${config.agent.endpoint}/cloud-agent/issue-credentials/credential-offers`, payload, {
    headers: cloudAgentHeaders,
  });
  return res.data;
}

export async function createConnection() {
  const { data } = await axios.post(
    `${config.agent.endpoint}/cloud-agent/connections`,
    {
      label: 'Wallet Verify Connection',
    },
    { headers: cloudAgentHeaders },
  );
  const id = data.connectionId;
  let url = data.invitation.invitationUrl;
  url = url.replace('https://my.domain.com/path', config.wallet.connect_address);
  url += `&callback=${config.wallet.callback}/${id}`;
  return { id, url };
}

export async function getConnection(id: string) {
  const { data } = await axios.get(`${config.agent.endpoint}/cloud-agent/connections/${id}?t=${new Date().getTime()}`, {
    headers: cloudAgentHeaders,
  });
  return data;
}

export async function getVerifyStatus(session: string) {
  const url = `${config.kyc.endpoint}/v1/sessions/${session}/decision/fullauto?version=1.0.0`;
  const headers = {
    'X-AUTH-CLIENT': config.kyc.apikey,
    'X-HMAC-SIGNATURE': generateSignature(session),
  };

  return axios.get(url, { headers });
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


async function getDiditToken() {
  const url = 'https://apx.didit.me/auth/v2/token/';
  const encodedCredentials = Buffer.from(
    `${config.kyc.apikey}:${config.kyc.secret}`,
  ).toString('base64');
  
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
 
  try {
    const response = await axios.post(url, params, {
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
 
    return response.data;
 
  } catch (error) {
    console.error('Network error:', error);
    return null;
  }
};


export async function createDiditSession(did: string) {
  const now = new Date();
  
  if (!diditToken.access_token || diditToken.expire_at <= now) {
    const res = await getDiditToken();
    diditToken.access_token = res.access_token;
    diditToken.expire_at = new Date(now.getTime() + res.expires_in * 1000);
  }

  const url = `${config.kyc.endpoint}/v1/session/`;
  const body = {
    callback: `${config.kyc.callback}`,
    vendor_data: did,
  };

  const response = await axios.post(url, body, { headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${diditToken.access_token}`,
  }});
  if (response.status != 201) {
    throw Error(`could not create session res ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

export async function fetchDiditSession(sessionId: string) {
  const now = new Date();
  
  if (!diditToken.access_token || diditToken.expire_at <= now) {
    const res = await getDiditToken();
    diditToken.access_token = res.access_token;
    diditToken.expire_at = new Date(now.getTime() + res.expires_in * 1000);
  }

  const url = `${config.kyc.endpoint}/v1/session/${sessionId}/decision/?t=${now.getTime()}`;
  const response = await axios.get(url, { headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${diditToken.access_token}`,
  }});

  return response.data
}