import mongoose from "mongoose";
import { blogDbConnection } from '../dbConnections.js';

const blogSchema = new mongoose.Schema({
    title: String,
    content: String,
});

const Blog = blogDbConnection.model('Blog', blogSchema);

export default Blog;
