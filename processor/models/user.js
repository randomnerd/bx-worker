import mongoose from 'mongoose';
require('mongoose-long')(mongoose);
let Long = mongoose.Types.Long;
export const UserSchema = new mongoose.Schema({
  _id:          String,
  totpKey:      String,
  totpEnabled:  Boolean
});

UserSchema.statics = {};
UserSchema.methods = {};

export const User = mongoose.model('User', UserSchema);
