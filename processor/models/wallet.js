import mongoose from 'mongoose';
export const WalletSchema = new mongoose.Schema({
  _id:       String,
  currId:    String,
  userId:    String,
  address:   String,
  secret:    String,
  createdAt: Date
});

WalletSchema.statics = {
  newUserAddress: (userId, currId, address, secret, callback) => {
    let wallet = new Wallet({
      _id:       Random.id(),
      currId:    currId,
      userId:    userId,
      address:   address,
      secret:    secret,
      createdAt: new Date
    });
    wallet.save(callback);
    return wallet;
  }
};

export const Wallet = mongoose.model('Wallet', WalletSchema);
