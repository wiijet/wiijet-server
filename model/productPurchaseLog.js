var mongoose = require('mongoose');
var wiijetConsts = require('../config.json').CONSTS;
var Schema = mongoose.Schema;
var productPurchaseLogSchema = new Schema({
    productID: String,
    createdAt: {
        type: Date,
        default: Date.now,
        // Adding a few seconds extra so the record won't be deleted right away after 24hrs
        expires: wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.TODAY + 10
    }
});

var ProductPurchaseLog = mongoose.model('ProductPurchaseLog', productPurchaseLogSchema);

module.exports = ProductPurchaseLog;