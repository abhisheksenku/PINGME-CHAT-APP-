const AWS = require('aws-sdk');
require('dotenv').config(); // Load environment variables

/**
 * Uploads a file buffer to your S3 bucket.
 * @param {Buffer} data The file data (from req.file.buffer)
 * @param {string} filename The unique filename to save as in S3 (e.g., "group-1/12345-cat.png")
 * @returns {Promise<string>} A promise that resolves with the public S3 URL of the file.
 */
function uploadToS3(data, filename) {
    const BUCKET_NAME = process.env.IAM_BUCKET_NAME;
    const IAM_USER_KEY = process.env.IAM_USER_KEY;
    const IAM_USER_SECRET = process.env.IAM_USER_SECRET;

    const s3 = new AWS.S3({
        accessKeyId: IAM_USER_KEY,
        secretAccessKey: IAM_USER_SECRET,
    });

    const params = {
        Bucket: BUCKET_NAME,
        Key: filename,
        Body: data,
        ACL: 'public-read' // Makes the file publicly viewable
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, (err, s3response) => {
            if (err) {
                console.log('S3 upload error:', err);
                reject(err);
            } else {
                // Log the URL, not the whole data object
                console.log('S3 upload success:', s3response.Location);
                // Resolve with the public URL
                resolve(s3response.Location);
            }
        });
    });
}

module.exports = { uploadToS3 };