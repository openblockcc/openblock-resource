#!/usr/bin/env node

/**
 * @fileoverview
 * Upload a file to.digital ocean spaces.
 * use --filePath to specify the file path, e.g: --filePath=test.zip
 * use --endPoint to specify address of digital ocean spaces, e.g: --endPoint=https://sgp1.digitaloceanspaces.com
 * use --bucket to specify the bucket name, e.g: --bucket=openblock
 */
import {S3, PutObjectCommand} from '@aws-sdk/client-s3';
import fs from 'fs';
import parseArgs from '../lib/parseArgs.js';
import path from 'path';
import clc from 'cli-color';

const FILE_DIR = 'resource';

const {filePath, endPoint, bucket} = parseArgs();

if (!filePath) {
    console.error(clc.red('ERR!: No file path specified'));
    process.exit(1);
}

const s3Client = new S3({
    endpoint: endPoint,
    region: 'us-east-1', // this SDK requires the region to be us-east-1, an AWS region name
    credentials: {
        accessKeyId: process.env.DO_KEY_ID,
        secretAccessKey: process.env.DO_SECRET_KEY
    }
});

const bucketParams = {
    Bucket: bucket,
    Key: `${FILE_DIR}/${path.basename(filePath)}`,
    Body: fs.createReadStream(filePath),
    ACL: 'public-read'
};

try {
    console.log(`Upload ${filePath} to ${bucketParams.Bucket}/${bucketParams.Key}`);
    s3Client.send(new PutObjectCommand(bucketParams)).then(() => {
        console.log(
            `Successfully uploaded object: ${
                bucketParams.Bucket
            }/${
                bucketParams.Key}`
        );
    });
} catch (err) {
    console.log('Error', err);
    process.exit(1);
}
