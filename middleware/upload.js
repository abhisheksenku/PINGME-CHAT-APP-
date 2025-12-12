const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the storage location for uploaded files
const storageDestination = 'uploads';

// --- Create the directory if it doesn't exist ---
fs.mkdirSync(storageDestination, { recursive: true });

// --- Configure how files are stored on disk ---
const storage = multer.diskStorage({
  /**
   * destination: Tells multer where to save the file.
   */
  destination: (req, file, cb) => {
    cb(null, storageDestination);
  },
  /**
   * filename: Creates a unique filename to prevent conflicts.
   * e.g., "1678886400000-mypic.png"
   */
  filename: (req, file, cb) => {
    // Create a unique name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * File filter to only allow certain file types
 */
const fileFilter = (req, file, cb) => {
  const fileExt = path.extname(file.originalname).toLowerCase();
  const fileMime = file.mimetype;

  const allowedExts = [
    '.jpeg', '.jpg', '.png', '.gif', // Images
    '.mp4', '.mov', '.avi', '.mkv', // Videos
    '.pdf',                       // Documents
    '.doc', '.docx',              // Word Documents
    '.txt'                        // Text files
  ];
  
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (allowedExts.includes(fileExt) && allowedMimes.includes(fileMime)) {
    cb(null, true); // Accept the file
  } else {
    console.warn(`File rejected: mimetype='${fileMime}', ext='${fileExt}'`);
    cb(new Error('File type not supported.'), false); // Reject the file
  }
};

// --- Create the multer middleware instance ---
const upload = multer({
  storage: storage, // Use the diskStorage we defined
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB file size limit
  fileFilter: fileFilter
});

// --- Export the middleware ---
module.exports = upload;