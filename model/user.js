import mongoose from "mongoose";
import { loginDbConnection } from '../dbConnections.js';

const UserSchema=new mongoose.Schema(
    {
        username : { type:String ,required:true, unique:true},
        password : { type:String ,required:true}
    },
    { collection: 'users' }
)

const User = loginDbConnection.model('User', UserSchema);

export default User;