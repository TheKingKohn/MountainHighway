import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Define allowed file types
const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fileType = file.fieldname === 'video' ? 'videos' : 'images';
    const typeDir = path.join(uploadsDir, fileType);
    
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }
    
    cb(null, typeDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// File filter function
const fileFilter = (req: any, file: any, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'photos') {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Only JPEG, PNG, and WebP are allowed.'));
    }
  } else if (file.fieldname === 'video') {
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video type. Only MP4, WebM, and QuickTime are allowed.'));
    }
  } else {
    cb(new Error('Invalid field name.'));
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_VIDEO_SIZE, // Use the larger limit
    files: 4 // Max 3 photos + 1 video
  }
});

// Middleware for listing uploads
export const uploadListingFiles = upload.fields([
  { name: 'photos', maxCount: 3 },
  { name: 'video', maxCount: 1 }
]);

// Validate uploaded files
export const validateListingFiles = (files: any) => {
  const errors: string[] = [];
  
  // Check if at least one photo is provided
  if (!files.photos || files.photos.length === 0) {
    errors.push('At least one photo is required');
  }
  
  // Validate photo sizes
  if (files.photos) {
    files.photos.forEach((photo: any, index: number) => {
      if (photo.size > MAX_IMAGE_SIZE) {
        errors.push(`Photo ${index + 1} exceeds 5MB limit`);
      }
    });
  }
  
  // Validate video size
  if (files.video && files.video[0]) {
    if (files.video[0].size > MAX_VIDEO_SIZE) {
      errors.push('Video exceeds 50MB limit');
    }
  }
  
  return errors;
};

// Get file URL for serving
export const getFileUrl = (filePath: string, req: any) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filePath}`;
};

// Delete file helper
export const deleteFile = (filePath: string) => {
  try {
    const fullPath = path.join(uploadsDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};

// Clean up orphaned files (can be used in a cleanup job)
export const cleanupFiles = async (validFiles: string[]) => {
  try {
    const imagesDir = path.join(uploadsDir, 'images');
    const videosDir = path.join(uploadsDir, 'videos');
    
    const cleanupDir = (dir: string) => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = `${path.basename(dir)}/${file}`;
          if (!validFiles.includes(filePath)) {
            deleteFile(filePath);
          }
        });
      }
    };
    
    cleanupDir(imagesDir);
    cleanupDir(videosDir);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};
