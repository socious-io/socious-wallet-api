import express, { Request, Response, NextFunction } from 'express';
import { upload, fetch, getVerifyStatus, createConnection, sendCredentials } from './utils';
import cors from 'cors';
import { config } from './config';

const app = express();
app.use(express.json());
app.use(cors({ origin: config.http.origin }));

const kyc: Record<string, string> = {};
const connections: Record<string, string> = {};

app.use((req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (config.apikey && apiKey !== config.apikey) {
    return res.status(403).json({ message: 'Invalid API key' });
  }
  next();
});

app.post('/sync', upload.single('file'), (req: Request, res: Response) => {
  res.send({
    message: 'File uploaded successfully.',
  });
});

app.get('/fetch/:did', async (req: Request, res: Response) => {
  const { did } = req.params;
  try {
    const buffer = await fetch(did);
    if (buffer) {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream', // or the correct MIME type for your file
        'Content-Disposition': `attachment; filename="${did}"`, // if you want the client to download the file
      });
      res.end(buffer); // Send the buffer content
    } else {
      res.status(404).send('File not found');
    }
  } catch (error) {
    console.error('Failed to fetch file:', error);
    res.status(500).send('Internal server error');
  }
});

app.post('/verify/start', (req: Request, res: Response) => {
  const { did, session } = req.body;
  if (did && session) kyc[did] = session;
  res.send({
    message: 'KYC start',
  });
});

app.get('/verify/:did/status', async (req: Request, res: Response) => {
  const { did } = req.params;
  const connection: any = {};
  const session = kyc[did];
  const { data } = await getVerifyStatus(session);

  if (data.verification?.status === 'approved') {
    const { id, url } = await createConnection();
    connection.id = id;
    connection.url = url;
    connections[did] = id;
  }

  res.send({
    verification: data.verification,
    connection,
  });
});

app.get('/verify/:did/claim', async (req: Request, res: Response) => {
  const { did } = req.params;
  const connectionId = connections[did];
  const claims = {
    type: 'verify',
    data: 'test verify VC',
  };

  res.send(await sendCredentials({ connectionId, claims }));
});

app.listen(config.http.port, () => {
  console.log(`Server is running at http://localhost:${config.http.port}`);
});
