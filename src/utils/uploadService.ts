import AWS from 'aws-sdk';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { Request } from 'express';

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

// Check if AWS credentials are configured
const isAWSConfigured = () => {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET);
};

// Local storage configuration (fallback)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// S3 storage configuration
const s3Storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_S3_BUCKET!,
  acl: 'public-read',
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const folder = req.path.includes('products') ? 'products' : 'general';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${folder}/${uniqueSuffix}-${file.originalname}`);
  },
});

// File filter for images only
const imageFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

// Create multer upload instances
export const uploadToS3 = multer({
  storage: isAWSConfigured() ? s3Storage : localStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5, // Maximum 5 files
  },
  fileFilter: imageFilter,
});

export const uploadSingle = uploadToS3.single('image');
export const uploadMultiple = uploadToS3.array('images', 5);

/**
 * Upload a single file to S3 or local storage
 */
export const uploadFile = uploadToS3.single('file');

/**
 * Delete file from S3
 */
export const deleteFromS3 = async (fileKey: string): Promise<boolean> => {
  try {
    if (!isAWSConfigured()) {
      console.warn('AWS not configured. Cannot delete from S3.');
      return false;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
    };

    await s3.deleteObject(params).promise();
    console.log(`File deleted from S3: ${fileKey}`);
    return true;
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return false;
  }
};

/**
 * Get signed URL for private file access
 */
export const getSignedUrl = (fileKey: string, expires: number = 3600): string | null => {
  try {
    if (!isAWSConfigured()) {
      return null;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
      Expires: expires, // URL expires in seconds
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

/**
 * List files in S3 bucket
 */
export const listFiles = async (prefix: string = ''): Promise<AWS.S3.Object[]> => {
  try {
    if (!isAWSConfigured()) {
      return [];
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Prefix: prefix,
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  } catch (error) {
    console.error('Error listing files from S3:', error);
    return [];
  }
};

/**
 * Check if file exists in S3
 */
export const fileExists = async (fileKey: string): Promise<boolean> => {
  try {
    if (!isAWSConfigured()) {
      return false;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get file metadata from S3
 */
export const getFileMetadata = async (fileKey: string): Promise<AWS.S3.HeadObjectOutput | null> => {
  try {
    if (!isAWSConfigured()) {
      return null;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
    };

    return await s3.headObject(params).promise();
  } catch (error) {
    console.error('Error getting file metadata:', error);
    return null;
  }
};

/**
 * Copy file within S3 bucket
 */
export const copyFile = async (sourceKey: string, destinationKey: string): Promise<boolean> => {
  try {
    if (!isAWSConfigured()) {
      return false;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,
      Key: destinationKey,
    };

    await s3.copyObject(params).promise();
    console.log(`File copied from ${sourceKey} to ${destinationKey}`);
    return true;
  } catch (error) {
    console.error('Error copying file in S3:', error);
    return false;
  }
};

/**
 * Generate upload presigned URL for client-side uploads
 */
export const generateUploadUrl = (fileKey: string, contentType: string, expires: number = 300): string | null => {
  try {
    if (!isAWSConfigured()) {
      return null;
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: fileKey,
      Expires: expires,
      ContentType: contentType,
      ACL: 'public-read',
    };

    return s3.getSignedUrl('putObject', params);
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return null;
  }
};

export { isAWSConfigured };
