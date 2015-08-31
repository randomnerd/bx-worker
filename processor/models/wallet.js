import mongoose from 'mongoose'
export var WalletSchema = new mongoose.Schema({
  _id:        String,
  currId:     String,
  userId:     String,
  address:    String,
  createdAt:  Date
});

WalletSchema.statics = {
  newUserAddress: (userId, currId, address, callback) => {
    let wallet = new Wallet({
      _id: Random.id(),
      currId: currId,
      userId: userId,
      address: address,
      createdAt: new Date
    });
    wallet.save(callback);
    return wallet;
  }
}

export var Wallet = mongoose.model('Wallet', WalletSchema);