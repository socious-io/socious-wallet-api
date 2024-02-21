export const config = {
    bucket: process.env.AWS_BUCKET,
    aws: {
        region: process.env.AWS_DEFAULT_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    }
}