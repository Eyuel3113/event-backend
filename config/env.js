const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'event_booking_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
  },
  
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'your_default_access_secret_development',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your_default_refresh_secret_development',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || 'development@example.com',
    pass: process.env.SMTP_PASS || 'development_password',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880,
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif'
    ],
  },
  
  payment: {
    telebirrApiKey: process.env.TELEBIRR_API_KEY || 'mock_telebirr_key',
    cbeApiKey: process.env.CBE_API_KEY || 'mock_cbe_key',
  },
  
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  
  s3: {
    bucket: process.env.S3_BUCKET,
    key: process.env.S3_KEY,
    secret: process.env.S3_SECRET,
    region: process.env.S3_REGION,
  },
};

module.exports = config;