import mongoose from 'mongoose';
export const NotificationSchema = new mongoose.Schema({
  _id:       String,
  userId:    String,
  title:     String,
  message:   String,
  type:      String,
  ack:       Boolean,
  createdAt: Date
});

NotificationSchema.statics = {
  notify: function(userId, title, message, type) {
    let notification = new Notification({
      _id:       Random.id(),
      userId:    userId,
      title:     title,
      message:   message,
      type:      type,
      ack:       false,
      createdAt: new Date()
    });
    notification.save((err) => {
      if (err) throw err;
    });
  }
};

export const Notification = mongoose.model('Notification', NotificationSchema);
