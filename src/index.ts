import express, { Request, Response, NextFunction } from 'express';
import { upload, fetch, getVerifyStatus, createConnection, sendCredentials, getConnection,  createDiditSession, fetchDiditSession } from './utils';
import cors from 'cors';
import { config } from './config';

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // Adjust the limit as needed
app.use(express.urlencoded({ limit: '10mb', extended: true }));  // For form submissions


const kyc: Record<string, string> = {};
const connections: Record<string, string> = {};

const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { method, url } = req;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};

const apiKeyRequired = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (config.apikey && apiKey !== config.apikey) {
    return res.status(403).json({ message: 'Invalid API key' });
  }
  next();
};

app.use(loggerMiddleware)

app.get('/ping', (req: Request, res: Response) => {
  res.send({'message': 'pong'})
})

app.post('/sync', apiKeyRequired, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.error('Sync upload error:', err.message);
      return res.status(503).json({ message: 'Backup storage temporarily unavailable' });
    }
    res.send({ message: 'File uploaded successfully.' });
  });
});

app.get('/fetch/:did', apiKeyRequired, async (req: Request, res: Response) => {
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

app.post('/verify/start', apiKeyRequired, async (req: Request, res: Response) => {
  const { did, session } = req.body;
  const response = {
    message: 'success',
    url: undefined,
    session: session,
  }

  if (did && session) {
    const { session_url } = await fetchDiditSession(session);
    response.url = session_url;    
  } else {
    const { url, session_id } = await createDiditSession(did);    
    response.url = url;
    response.session = session_id;
  }

  kyc[did] = response.session;

  res.send(response);
});


app.get('/verify/:did/status', apiKeyRequired, async (req: Request, res: Response) => {
  const { did } = req.params;
  const connection: any = {};
  const session = kyc[did];
  if (!session) return res.status(400).json({ message: 'Verffication session could not be found' });

  try {
    const data = await fetchDiditSession(session);

    if (data.status.toLowerCase() === 'approved') {
      const { id, url } = await createConnection();
      connection.id = id;
      connection.url = url;
      connections[id] = did;
    }

    res.send({
      verification: { status: data.status },
      connection,
    });
  } catch (err) {
    console.log(err);
    res.send({
      verification: null,
      connection: null,
    });
  }
});

app.get('/verify/claims/:id', async (req: Request, res: Response) => {
  const accepted = req.query.accept === 'true' ? true : false;
  const { id } = req.params;

  if (!accepted) return res.send({ message: 'not accepted' });

  const did = connections[id];
  const session = kyc[did];
  try {
    const data  = await fetchDiditSession(session);
    if (data.status.toLowerCase() !== 'approved') {
      return res.status(403).json({ message: 'Verffication is not valid' });
    }

    const claims = {
      type: 'verification',
      first_name: data.kyc.first_name,
      last_name: data.kyc.last_name,
      gender: data.kyc.gender,
      id_number: data.kyc.document_number,
      date_of_birth: data.kyc.date_of_birth,
      country: data.kyc.issuing_state_name,
      document_type: data.kyc.document_type,
      document_number: data.kyc.document_number,
      issued_date: new Date().toISOString(),
    };

    await sendCredentials({ connectionId: id, claims });
    res.send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.send({ message: 'decision not maked yet' });
  }
});

app.get('/connections/:id', async (req: Request, res: Response) => {
  const conn = await getConnection(req.params.id);
  res.send(conn);
});

const server = app.listen(config.http.port, () => {
  console.log(`Server is running at http://localhost:${config.http.port}`);
});

server.setTimeout(5 * 60 * 1000); 