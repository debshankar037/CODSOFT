import mongoose from 'mongoose';
import { transactionDbConnection } from '../dbConnections.js';

const Schema = mongoose.Schema;

// Define the schema for a transaction object
const transactionSchema = new Schema({
    transactionDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    transactionAmount: {
        type: Number,
        required: true
    },
    invoicePdf: {
        type: String,
        required: true
    }
});

// Define the schema for a user transaction
const userTransactionSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    transactions: [transactionSchema]
});

// Create the model from the schema
const UserTransaction = transactionDbConnection.model('UserTransaction', userTransactionSchema);

export default UserTransaction;