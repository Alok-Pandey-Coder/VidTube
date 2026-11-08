import 'dotenv/config';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

let client;
const s3 = () =>
  (client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  }));

const TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
};
const cacheFor = (ext) =>
  ext === '.ts' || ext === '.mp4' ? 'public, max-age=86400' : 'public, max-age=60';

export async function r2Put(localPath, key) {
  const ext = path.extname(key).toLowerCase();
  await new Upload({
    client: s3(),
    params: {
      Bucket: process.env.R2_BUCKET,
      Key: key,
      Body: fs.createReadStream(localPath),
      ContentType: TYPES[ext] || 'application/octet-stream',
      CacheControl: cacheFor(ext),
    },
  }).done();
}

async function* walk(dir) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

export async function r2PutDir(localDir, prefix) {
  const files = [];
  for await (const f of walk(localDir)) files.push(f);

  for (let i = 0; i < files.length; i += 8) {
    await Promise.all(
      files.slice(i, i + 8).map((f) => {
        const rel = path.relative(localDir, f).split(path.sep).join('/');
        return r2Put(f, `${prefix}/${rel}`);
      }),
    );
  }
}

export async function r2Download(key) {
  const out = path.join(os.tmpdir(), `vidtube-src-${crypto.randomUUID()}${path.extname(key)}`);
  const res = await s3().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(out));
  return out;
}

export async function r2Delete(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}