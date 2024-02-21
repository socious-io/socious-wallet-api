import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import {config } from './config';

const s3 = new S3Client({
    region: config.bucket,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
})

export const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: config.bucket as string,
      metadata: function (req, file, cb) {
        cb(null, {fieldName: file.fieldname});
      },
      key: function (req, file, cb) {
        cb(null, file.filename)
      }
    })
  });

export const fetch = async (filename: string) => {
    const command = new GetObjectCommand({
        Bucket: config.bucket,
        Key: filename,
      });
    const { Body } = await s3.send(command);
    return Body;
}