#!/usr/bin/env node

/**
 * @fileoverview
 * Fetch the latest release info and upload it to digital ocean spaces.
 * use --repo to specify the repo of github repository, e.g: --repo=openblockcc/external-resources-v2
 * use --endPoint to specify address of digital ocean spaces, e.g: --endPoint=https://sgp1.digitaloceanspaces.com
 * use --bucket to specify the bucket name, e.g: --bucket=openblock
 */
import fetch from 'node-fetch';
import {S3, PutObjectCommand} from '@aws-sdk/client-s3';
import parseArgs from '../lib/parseArgs.js';

const {repo, endPoint, bucket} = parseArgs();

const FILE_PATH = 'resource/latestRelease.json';

const s3Client = new S3({
    endpoint: endPoint,
    region: 'us-east-1', // this SDK requires the region to be us-east-1, an AWS region name
    credentials: {
        accessKeyId: process.env.DO_KEY_ID,
        secretAccessKey: process.env.DO_SECRET_KEY
    }
});

const bucketParams = content => ({
    Bucket: bucket,
    Key: FILE_PATH,
    Body: Buffer.from(content, 'utf8'),
    ACL: 'public-read'
});

const getLatest = () => {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;

    return fetch(url)
        .then(res => res.json());
};

getLatest().then(data => {
    try {
        data = JSON.stringify(data, null, 4);
        console.log(`Upload release note to ${bucketParams(data).Bucket}/${bucketParams(data).Key}`);
        s3Client.send(new PutObjectCommand(bucketParams(data))).then(() => {
            console.log(
                `Successfully uploaded object: ${
                    bucketParams(data).Bucket
                }/${
                    bucketParams(data).Key}`
            );
        });
    } catch (err) {
        console.log('Error', err);
        process.exit(1);
    }
});
