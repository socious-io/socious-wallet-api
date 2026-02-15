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
const approvedConnections: Record<string, { id: string; url: string }> = {};
const credentialIssued: Record<string, boolean> = {};

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
  const response: { message: string; url: any; session: any } = {
    message: 'success',
    url: undefined,
    session: session,
  }

  // Check if server already has a session for this DID (handles double-tap)
  const existingServerSession = kyc[did];
  const sessionToCheck = session || existingServerSession;

  if (did && sessionToCheck) {
    try {
      const data = await fetchDiditSession(sessionToCheck);
      const status = data.status?.toLowerCase();
      console.log(`[START] Checking session=${sessionToCheck} didit_status=${data.status} session_url=${data.session_url}`);

      if (['approved', 'declined', 'expired', 'abandoned'].includes(status)) {
        // Terminal status — create a fresh session
        console.log(`[START] Session ${sessionToCheck} has terminal status (${data.status}), creating fresh session`);
        const { url, session_id } = await createDiditSession(did);
        response.url = url;
        response.session = session_id;
      } else {
        // Session is still active (not started, in progress, in review) — reuse it
        response.url = data.session_url;
        response.session = sessionToCheck;
        console.log(`[START] Reusing active session=${sessionToCheck} url=${data.session_url}`);
      }
    } catch (err: any) {
      console.error(`[START] Error checking session ${sessionToCheck}:`, err?.message);
      // Session lookup failed — create fresh
      const { url, session_id } = await createDiditSession(did);
      response.url = url;
      response.session = session_id;
    }
  } else {
    const { url, session_id } = await createDiditSession(did);
    console.log(`[START] Created new session=${session_id} url=${url}`);
    response.url = url;
    response.session = session_id;
  }

  kyc[did] = response.session;

  res.send(response);
});


app.get('/verify/:did/status', apiKeyRequired, async (req: Request, res: Response) => {
  const { did } = req.params;
  const connection: any = {};
  let session = kyc[did];
  // Self-heal after server restart: accept session from query param
  if (!session && req.query.session) {
    session = req.query.session as string;
    kyc[did] = session;
  }
  if (!session) return res.status(400).json({ message: 'Verffication session could not be found' });

  try {
    const data = await fetchDiditSession(session);
    console.log(`[STATUS] did=${did.substring(0, 16)}... session=${session} didit_status=${data.status} has_kyc=${!!data.kyc} keys=${Object.keys(data).join(',')}`);

    if (data.status?.toLowerCase() === 'approved' && !credentialIssued[did]) {
      try {
        if (!approvedConnections[did]) {
          const { id, url } = await createConnection();
          approvedConnections[did] = { id, url };
          connections[id] = did;
          console.log(`[STATUS] Connection created: id=${id}`);
        }
        connection.id = approvedConnections[did].id;
        connection.url = approvedConnections[did].url;
      } catch (connErr) {
        console.error('Failed to create connection:', connErr);
      }
    }

    res.send({
      verification: { status: data.status },
      connection,
    });
  } catch (err: any) {
    console.error(`[STATUS] Error fetching DIDIT session=${session}:`, err?.response?.status, err?.response?.data || err.message);
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
    // Mark credential as issued so status endpoint stops creating new connections
    if (did) credentialIssued[did] = true;
    console.log(`[CLAIMS] Credential issued for did=${did?.substring(0, 16)}... connectionId=${id}`);
    res.send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.send({ message: 'decision not maked yet' });
  }
});

// DIDIT redirects here after verification; serves page that bounces back to the native app.
// DIDIT passes ?verificationSessionId=xxx&status=yyy as query params.
// We use the verificationSessionId to update our kyc map so status polling uses the correct session.
app.get('/verify/complete', async (req: Request, res: Response) => {
  const verificationSessionId = req.query.verificationSessionId as string;
  const status = req.query.status as string;
  console.log(`[CALLBACK] DIDIT callback: verificationSessionId=${verificationSessionId} status=${status}`);

  // Update kyc map: look up vendor_data (DID) from the DIDIT session and remap kyc[did] to this session
  if (verificationSessionId) {
    try {
      const data = await fetchDiditSession(verificationSessionId);
      const did = data.vendor_data;
      if (did) {
        const oldSession = kyc[did];
        kyc[did] = verificationSessionId;
        console.log(`[CALLBACK] Remapped kyc[${did.substring(0, 16)}...] from ${oldSession} to ${verificationSessionId} (status=${data.status})`);
      }
    } catch (err: any) {
      console.error(`[CALLBACK] Failed to fetch DIDIT session ${verificationSessionId}:`, err?.message);
    }
  }

  const walletWebUrl = config.wallet.connect_address.replace('/connect', '');
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verification Complete</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;
justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;text-align:center}
.c{padding:32px}.btn{display:inline-block;margin-top:24px;padding:14px 32px;
background:#6366f1;color:#fff;border-radius:12px;text-decoration:none;font-size:17px}</style>
</head><body><div class="c">
<h2>Verification Complete</h2>
<p>Redirecting back to Socious Wallet&hellip;</p>
<a class="btn" href="sociouswallet://verify-complete">Return to Wallet</a>
</div>
<script>
var t=setTimeout(function(){window.location.href="${walletWebUrl}"},2000);
try{window.location.href="sociouswallet://verify-complete";
setTimeout(function(){if(!document.hidden){clearTimeout(t);window.location.href="${walletWebUrl}"}},1500)}catch(e){window.location.href="${walletWebUrl}"}
</script>
</body></html>`);
});

app.get('/connections/:id', async (req: Request, res: Response) => {
  const conn = await getConnection(req.params.id);
  res.send(conn);
});

app.post('/diag', (req: Request, res: Response) => {
  const { step, data, error } = req.body;
  console.log(`[DIAG] ${step}:`, JSON.stringify(data || error || '').substring(0, 500));
  res.send({ ok: true });
});

const server = app.listen(config.http.port, () => {
  console.log(`Server is running at http://localhost:${config.http.port}`);
});

server.setTimeout(5 * 60 * 1000); 