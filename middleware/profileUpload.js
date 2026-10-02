import multer from 'multer';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      const error = new Error('Only JPG, JPEG, PNG, and WEBP images are allowed.');
      error.statusCode = 400;
      return callback(error);
    }
    callback(null, true);
  },
});

export default upload;
