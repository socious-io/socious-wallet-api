import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { Readable } from 'stream';
import { config } from './config';

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
