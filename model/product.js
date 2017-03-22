// grab the things we need
var mongoose = require('mongoose');
var wiijetConsts = require('../config.json').CONSTS;
var ProductViewLog = require('./productViewLog');
var ProductPurchaseLog = require('./productPurchaseLog');
var Schema = mongoose.Schema;
var productSchema = new Schema({
    id: {
        type: String,
        unique: true,
        index: true
    },
    url: String,
    title: String,
    // beginning of counters
    nonwiijetViewsCounter: {
        type: Number,
        default: 0
    },
    wiijetViewsCounter: {
        type: Number,
        default: 0
    },
    // add to cart counter for control group
    nonWiijetAddedToCartCounter: {
        type: Number,
        default: 0
    },
    wiijetAddedToCartCounter: {
        type: Number,
        default: 0
    },
    // purchase counter for control group
    nonWiijetPurchasesCounter: {
        type: Number,
        default: 0
    },
    wiijetPurchasesCounter: {
        type: Number,
        default: 0
    },
    // end of counters
    price: String,
    priceBefore: String,
    priceCurrency: String,
    inStock: {
        type: Boolean,
        default: true
    }
});

productSchema.methods.addViewer = function (viewingUser, cb) {
    console.log('addViewer called for product ', this);

    var self = this;

    try {
        if (viewingUser.inControlGroup) {
            self.wiijetViewsCounter++;
        } else {
            self.nonwiijetViewsCounter++;
        }

        self.save(function (err) {
            if (err) {
                return cb(err);
            }

            console.log('Updated product views counter successfully');
            console.log('control group views counter', self.wiijetViewsCounter);
            console.log('non control group views counter', self.nonWiijetViewsCounter);

            ProductViewLog.create({
                productID: self.id
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                console.log('added  product view log successfully');
                console.log('addViewer - success');

                cb(null);
            });
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.getActiveViewersCount = function (cb) {
    var self = this;

    try {
        ProductViewLog.count({
            productID: self.id
        }, function (err, count) {
            if (err) {
                cb(err);
            } else {
                count = count || 0;

                console.log('getActiveViewersCount - received count ', count);

                cb(null, count);
            }
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.getLastPurchasesCount = function (cb) {
    try {
        var time = new Date().getTime() - wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.LAST * 1000;

        ProductPurchaseLog.aggregate([{
            $match: {
                createdAt: {
                    $gte: new Date(time)
                }
            }
        }, {
            $group: {
                _id: null,
                count: {
                    $sum: 1
                }
            }
        }], function (err, result) {
            if (err) {
                cb(err);
            } else {
                result.count = result.count || 0;

                console.log('getLastPurchasesCount - received count ', result.count);

                cb(null, result.count);
            }
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.getLastHourPurchasesCount = function (cb) {
    try {
        var time = new Date().getTime() - wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.LAST_HOUR * 1000;

        ProductPurchaseLog.aggregate([{
            $match: {
                createdAt: {
                    $gte: new Date(time)
                }
            }
        }, {
            $group: {
                _id: null,
                count: {
                    $sum: 1
                }
            }
        }], function (err, result) {
            if (err) {
                cb(err);
            } else {
                result.count = result.count || 0;

                console.log('getLastHourPurchasesCount - received count ', result.count);

                cb(null, result.count);
            }
        });
    } catch (e) {
        cb(e);
    }
};
// Get the first purchase log which occured after the first hour, so when
// we got the highest rank from the last 3 hours purchase time frame and we need to
// display a notification using the "Ago" format, we need that first purchase after the first hour so
// we could display for the user "this product was purchased X hours ago" (maybe with minutes in the future)
productSchema.methods.getPostHourFirstPurchaseLog = function (cb) {
    try {
        var time = new Date().getTime() - wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.LAST_HOUR * 1000;

        ProductPurchaseLog.findOne({
            $match: {
                createdAt: {
                    $lt: new Date(time)
                }
            }
        }, function (err, result) {
            if (err) {
                cb(err);
            } else {
                console.log('getPostHourFirstPurchaseLog - received a purchase log ', result);

                cb(null, result);
            }
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.getLast3HoursPurchasesCount = function (cb) {
    try {
        var time = new Date().getTime() - wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.LAST_3_HOURS * 1000;

        ProductPurchaseLog.aggregate([{
            $match: {
                createdAt: {
                    $gte: new Date(time)
                }
            }
        }, {
            $group: {
                _id: null,
                count: {
                    $sum: 1
                }
            }
        }], function (err, result) {
            if (err) {
                cb(err);
            } else {
                result.count = result.count || 0;

                console.log('getLast3HoursPurchasesCount - received count ', result.count);

                cb(null, result.count);
            }
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.getTodaysPurchasesCount = function (cb) {
    try {
        var time = new Date().getTime() - wiijetConsts.FORMULAS.TIME_FRAMES_IN_SECONDS.PURCHASES.TODAY * 1000;

        ProductPurchaseLog.aggregate([{
            $match: {
                createdAt: {
                    $gte: new Date(time)
                }
            }
        }, {
            $group: {
                _id: null,
                count: {
                    $sum: 1
                }
            }
        }], function (err, result) {
            if (err) {
                cb(err);
            } else {
                result.count = result.count || 0;

                console.log('getTodaysPurchasesCount - received count ', result.count);

                cb(null, result.count);
            }
        });
    } catch (e) {
        cb(e);
    }
};

productSchema.methods.updateAddedToCartCounter = function (quantity, referringUser, cb) {
    try {
        referringUser.inControlGroup ? this.wiijetAddedToCartCounter++ : this.nonWiijetAddedToCartCounter++;

        this.save(function (err, savedProduct) {
            if (err) {
                cb(err);
            }

            referringUser.saveAddedToCartProduct(self.id, quantity, function (err, updatedUser) {
                if (err) {
                    cb(err);
                }

                cb(null, savedProduct);
            });
        });
    } catch (e) {
        cb(e);
    }
};

// productSchema.methods.incrementPurchaseCountersByOne = function(involvedUser, cb) {
//     try {
//         // Check if the product was added to cart during control group and if so we count the purchse as during control group
//         involvedUser.wiijetAddedToCartProductIDs.indexOf(this.id) !== -1 ? this.wiijetPurchasesCounter++ : this.nonWiijetPurchasesCounter++;

//         this.save(function(err, savedProduct) {
//             if (err) {
//                 cb(err);
//             }

//             cb(null, savedProduct);
//         });
//     } catch (e) {
//         cb(e);
//     }
// };

productSchema.methods.generateViewStatisticsNotificationData = function () {
    var totalViewsCounter = this.getActiveViewersCount();

    return {
        type: wiijetConsts.NOTIFICATION_TYPE.ACTIVE_VIEWS,
        data: totalViewsCounter
    };
};

productSchema.methods.generateAddedToCartStatisticsNotificationData = function () {

};

productSchema.methods.generatePurchaseStatisticsNotificationData = function () {

};

var Product = mongoose.model('Product', productSchema);

module.exports = Product;