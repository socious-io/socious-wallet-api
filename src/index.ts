import express, { Request, Response } from 'express';
import 'dotenv/config';
import { upload, fetch } from './utils';

const app = express();
const PORT = 3000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World with TypeScript!');
});

app.post('/sync', upload.single('file'), (req: Request, res: Response) => {
  res.send({
    message: 'File uploaded successfully.'
  });  
});

app.get('/fetch/:did', upload.single('file'), async (req: Request, res: Response) => {
  const { did } = req.params
  const body = await fetch(did)
  if (body)
    (body as NodeJS.ReadableStream).pipe(res);
  else
    res.status(404).send('File not found');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
