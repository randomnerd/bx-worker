import mongoose from 'mongoose';
import Promise from 'bluebird';
export const SettingSchema = new mongoose.Schema({
  _id:       String,
  value:     mongoose.Schema.Types.Mixed,
  createdAt: Date,
  updatedAt: Date
});

SettingSchema.statics = {
  get: function(key) { return this.findOne({_id: key}); },
  set: function(key, value) {
    return this.get(key).then((setting) => {
      if (setting) {
        setting.value = value;
        setting.updatedAt = new Date;
        return setting.save();
      } else {
        return this.create({
          _id: key,
          value,
          createdAt: new Date,
          updatedAt: new Date
        });
      }
    });
  }
};

export const Setting = mongoose.model('Setting', SettingSchema);
