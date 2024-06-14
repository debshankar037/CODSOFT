import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Connection to the login database
const loginDbConnection = mongoose.createConnection(process.env.LOGIN_DB_URI);

loginDbConnection.on('connected', () => {
  console.log('Connected to login database!');
});

loginDbConnection.on('error', (err) => {
  console.error('Error connecting to login database:', err);
});

// Connection to the transaction database
const transactionDbConnection = mongoose.createConnection(process.env.TRANSACTION_DB_URI);

transactionDbConnection.on('connected', () => {
  console.log('Connected to transaction database!');
});

transactionDbConnection.on('error', (err) => {
  console.error('Error connecting to transaction database:', err);
});

// Connection to the blog database
const blogDbConnection = mongoose.createConnection(process.env.BLOG_DB_URI);

blogDbConnection.on('connected', () => {
  console.log('Connected to blog database!');
});

blogDbConnection.on('error', (err) => {
  console.error('Error connecting to blog database:', err);
});

export { loginDbConnection, transactionDbConnection, blogDbConnection };