import express, { Request, Response, NextFunction } from 'express';
import { upload, fetch, getVerifyStatus, createConnection, sendCredentials, getConnection } from './utils';
import cors from 'cors';
import { config } from './config';

const app = express();
app.use(express.json());
app.use(cors());

const kyc: Record<string, string> = {};
const connections: Record<string, string> = {};

const apiKeyRequired = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (config.apikey && apiKey !== config.apikey) {
    return res.status(403).json({ message: 'Invalid API key' });
  }
  next();
};

app.post('/sync', apiKeyRequired, upload.single('file'), (req: Request, res: Response) => {
  res.send({
    message: 'File uploaded successfully.',
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

app.post('/verify/start', apiKeyRequired, (req: Request, res: Response) => {
  const { did, session } = req.body;
  if (did && session) kyc[did] = session;
  res.send({
    message: 'KYC start',
  });
});

app.get('/verify/:did/status', apiKeyRequired, async (req: Request, res: Response) => {
  const { did } = req.params;
  const connection: any = {};
  const session = kyc[did];
  if (!session) return res.status(400).json({ message: 'Verffication session could not be found' });

  try {
    const { data } = await getVerifyStatus(session);

    if (data.decision === 'approved') {
      const { id, url } = await createConnection();
      connection.id = id;
      connection.url = url;
      connections[id] = did;
    }

    res.send({
      verification: { status: data.decision },
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
    const { data } = await getVerifyStatus(session);
    if (data.decision !== 'approved') {
      return res.status(403).json({ message: 'Verffication is not valid' });
    }

    const claims = {
      type: 'verification',
      first_name: data.person.firstName?.value,
      last_name: data.person.lastName?.value,
      gender: data.person.gender?.value,
      id_number: data.person.idNumber?.value,
      date_of_birth: data.person.dateOfBirth?.value,
      country: data.document.country?.value,
      document_type: data.document.type?.value,
      document_number: data.document.number?.value,
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

app.listen(config.http.port, () => {
  console.log(`Server is running at http://localhost:${config.http.port}`);
});
