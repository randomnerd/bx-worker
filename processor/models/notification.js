import mongoose from 'mongoose'
export var NotificationSchema = new mongoose.Schema({
  _id:     String,
  userId:  String,
  title:   String,
  message: String,
  type:    String
});
NotificationSchema.statics.notify = (userId, title, message, type) => {
  let notification = new Notification({
    _id: Random.id(),
    userId: userId,
    title: title,
    message: message,
    type: type
  });
  notification.save();
}
export var Notification = mongoose.model('Notification', NotificationSchema);
