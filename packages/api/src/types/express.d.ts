// Express type augmentations for multer and custom properties

declare global {
  namespace Express {
    interface Request {
      file?: any;
      files?: any;
    }
  }
}

export {};
