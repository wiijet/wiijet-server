var mongoose = require('mongoose');
var wiijetConsts = require('../config.json').CONSTS;
var Schema = mongoose.Schema;
var productViewLogSchema = new Schema({
    productID: String,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.VIEWS.ACTIVE
    }
});

var ProductViewLog = mongoose.model('ProductViewLog', productViewLogSchema);

module.exports = ProductViewLog;