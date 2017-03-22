var util = require('util');
var url = require('url');
var async = require('async');
var Models = require('./model/models');
var _ = require('lodash');
var moment = require('moment');
var User = Models.User;
var Product = Models.Product;
// var Category = Models.Category;
var wiijetConfig = require('./config.json');
var wiijetConsts = wiijetConfig.CONSTS;
var wiijetLocaleFormats = require('./locale.json').FORMATS;
var clientLocale;
var referringUser;

function pageViewEventHandler(data, cb) {
    var product = data.product;
    var referringUser = data.referringUser;

    try {
        storeDataForViewedProduct(referringUser, product, cb);
    } catch (e) {
        cb(e);
    }

    function storeDataForViewedProduct(referringUser, product, cb) {
        try {
            product.addViewer(referringUser, function (err) {
                if (err) {
                    throw err;
                }

                cb(null, product);
            });
        } catch (e) {
            cb(e);
        }
    }
}

function addToCartEventHandler(data, cb) {
    var product = data.product,
        qty = data.quantity,
        referringUser = data.referringUser;

    try {
        return getStatsForAddedToCartProduct(qty, referringUser, product, cb);
    } catch (e) {
        return cb(e);
    }

    function getStatsForAddedToCartProduct(qty, referringUser, product, cb) {
        try {
            product.updateAddedToCartCounter(qty, referringUser, function (err, updatedProduct) {
                if (err) {
                    throw err;
                }

                return cb();
            });
        } catch (e) {
            return cb(e);
        }
    }
}

// function purchaseEventHandler(data, cb) {
//     var productIDs = data.purchasedProductURLs,
//         referringUser = data.referringUser;

//     try {
//         Product.find({
//             'id': {
//                 $in: productIDs
//             }
//         }, function(err, products) {
//             if (err) {
//                 throw err;
//             }

//             // Array to hold async tasks
//             var asyncTasks = [];

//             products.forEach(
//                 function(product) {
//                     asyncTasks.push(function(callback) {
//                         product.incrementPurchaseCountersByOne(referringUser, function(err, updatedProduct) {
//                             if (err) {
//                                 throw err;
//                             }

//                             callback();
//                         });
//                     });
//                 });

//             async.parallel(asyncTasks, function() {
//                 // All tasks are done now
//                 cb();
//             });
//         });
//     } catch (e) {
//         return cb(e);
//     }
// }

function digestDataAndGetStatistics(eventData, clientMetaData, cb) {
    var data = eventData.data;
    var eventType = eventData.eventType;
    var clientLocale = clientMetaData.clientLocale;
    var digestDataAndGetStatisticsCallback = cb;

    data.referringUser = clientMetaData.referringUser;

    console.log('digestDataAndGetStatistics, received event type ', eventType, ' with data ', data);

    console.assert(data && !_.isUndefined(eventType), 'No event data or type specified');

    try {
        if (eventType === wiijetConsts.EVENT_TYPE.PURCHASE) {
            sendDataToCorrectEventHandler(eventType, data);
        } else {
            Product.findOne({
                'id': data.url
            }, productQueryResultHandler);
        }
    } catch (e) {
        digestDataAndGetStatisticsCallback(e);
    }

    function productQueryResultHandler(err, product) {
        if (err) {
            return digestDataAndGetStatisticsCallback(err);
        }

        console.log('product query result is', product);

        // create a new product
        if (!product) {
            try {
                console.log('Product wasn\'t found, creating it');

                Product.create({
                    id: data.url,
                    url: data.url,
                    price: data.price,
                    priceBefore: data.priceBefore,
                    priceCurrency: data.priceCurrency,
                    inStock: data.inStock || true
                }, productFoundHandler);
            } catch (e) {
                throw new Error('Could not create a new product ' + e);
            }
        } else {
            console.log('Product already exists, using it', product);

            data.product = product;

            return sendDataToCorrectEventHandler(eventType, data);
        }
    }

    function productFoundHandler(err, product) {
        if (err) {
            digestDataAndGetStatisticsCallback(err);
        }

        data.product = product;

        return sendDataToCorrectEventHandler(eventType, data);
    }

    function sendDataToCorrectEventHandler(eventType, data) {
        console.log('sendDataToCorrectEventHandler got', eventType, data);

        switch (eventType) {
            case wiijetConsts.EVENT_TYPE.PAGE_VIEW:
                pageViewEventHandler(data, generateMostRelevantNotificationForUser);
                break;
            case wiijetConsts.EVENT_TYPE.ADD_TO_CART:
                addToCartEventHandler(data, digestDataAndGetStatisticsCallback);
                break;
            case wiijetConsts.EVENT_TYPE.PURCHASE:
                purchaseEventHandler(data, digestDataAndGetStatisticsCallback);
                break;
            default:
                throw new Error('Unsupported event type ', eventType);
                break;
        }
    }

    // Currently we generate notifications when user initally watching the product
    // The main goal is to make him add it to cart or even better - purchase.
    function generateMostRelevantNotificationForUser(err) {
        if (err) {
            return digestDataAndGetStatisticsCallback(err);
        }

        var product = data.product;

        async.series([
            function (cb) {
                console.log('running getActiveViewersCount');

                product.getActiveViewersCount(cb);
            },
            function (cb) {
                console.log('running getLastPurchasesCount');

                product.getLastPurchasesCount(cb);
            },
            function (cb) {
                console.log('running getLastHourPurchasesCount');

                product.getLastHourPurchasesCount(cb);
            },
            function (cb) {
                console.log('running getLast3HoursPurchasesCount');

                product.getLast3HoursPurchasesCount(cb);
            },
            function (cb) {
                console.log('running getTodaysPurchasesCount');

                product.getTodaysPurchasesCount(cb);
            }
        ], function (err, results) {
            // All tasks are done now
            if (err) {
                throw err;
            }

            console.log('Received count results ', results);

            var weightCalculationObjectsArr = [{
                type: 'active-viewers',
                count: 0,
                weight: wiijetConsts.FORMULAS.WEIGHTS.VIEWS.ACTIVE,
            }, {
                type: 'last-purchases',
                count: 0,
                weight: wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST,
            }, {
                type: 'last-hour-purchases',
                count: 0,
                weight: wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST_HOUR,
            }, {
                type: 'last-3-hours-purchases',
                count: 0,
                weight: wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST_3_HOURS,
            }, {
                type: 'todays-purchases',
                count: 0,
                weight: wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.TODAY,
            }];

            results.forEach(function (countResult, index) {
                weightCalculationObjectsArr[index].count = countResult;
            });


            return populateBestNotificationAccordingToWeights(product, weightCalculationObjectsArr);
        });


        function populateBestNotificationAccordingToWeights(product, weightCalculationObjects) {
            var topRankWeightObject;

            weightCalculationObjects.forEach(function (weightCalcObj) {
                weightCalcObj.rank = weightCalcObj.count * weightCalcObj.weight;

                if (!topRankWeightObject || topRankWeightObject.rank < weightCalcObj.rank) {
                    topRankWeightObject = weightCalcObj;
                }
            });

            console.log('Top rank weight obj is', topRankWeightObject);

            getNotificationContentForRankData(product, topRankWeightObject.weight, topRankWeightObject.count,
                function (err, notification) {
                    if (err) {
                        console.error('Got error while generating notification', err.message);
                    }

                    digestDataAndGetStatisticsCallback(null, err ? {} : notification);
                });
        }

        function getNotificationContentForRankData(product, weight, numberOfUsers, cb) {
            var content,
                notificationHTML = '',
                notificationType, message;

            if (!numberOfUsers) {
                return cb(new Error('Got no users to generate notification'));
            }

            try {
                switch (weight) {
                    case wiijetConsts.FORMULAS.WEIGHTS.VIEWS.ACTIVE:
                        message = util.format(wiijetLocaleFormats.VIEWS.ACTIVE[clientLocale], numberOfUsers);
                        notificationType = wiijetConsts.NOTIFICATION_TYPE.ACTIVE_VIEWS;

                        finalizeNotification(message, notificationType, cb);
                        break;
                    case wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST:
                        message = util.format(wiijetLocaleFormats.PURCHASES.LAST[clientLocale], numberOfUsers);
                        notificationType = wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES;

                        finalizeNotification(message, notificationType, cb);
                        break;
                    case wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST_HOUR:
                        message = util.format(wiijetLocaleFormats.PURCHASES.LAST_HOUR[clientLocale], numberOfUsers);
                        notificationType = wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES;

                        finalizeNotification(message, notificationType, cb);
                        break;
                    case wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.LAST_3_HOURS:
                        product.getPostHourFirstPurchaseLog(function (err, purchaseLog) {
                            var duration = moment.duration(moment(new Date()).diff(purchaseLog.createdAt));
                            var hours = duration.asHours();

                            if (hours === 0) {
                                hours = 1;
                            }

                            message = hours === 1 ? wiijetLocaleFormats.PURCHASES.LAST_3_HOURS.ONE_HOUR_AGO[clientLocale] : util.format(wiijetLocaleFormats.PURCHASES.LAST_3_HOURS[clientLocale], hours);
                            notificationType = wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES;

                            finalizeNotification(message, notificationType, cb);
                        });
                        break;
                    case wiijetConsts.FORMULAS.WEIGHTS.PURCHASES.TODAY:
                        message = util.format(wiijetLocaleFormats.PURCHASES.TODAY[clientLocale], numberOfUsers);
                        notificationType = wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES;

                        finalizeNotification(message, notificationType, cb);
                        break;
                }
            } catch (e) {
                cb(e);
            }

            function finalizeNotification(message, notificationType, cb) {
                if (!(message && !_.isUndefined(notificationType))) {
                    return cb(new Error('Could not generate content for notification ', weight, numberOfUsers));
                }

                notificationHTML = packNotificationHTMLContentByType(notificationType, message);

                console.log('Got notification html content', notificationHTML);

                return cb(null, {
                    data: notificationHTML,
                    type: notificationType
                });

                function packNotificationHTMLContentByType(type, message) {
                    var eyeIcon = '<span class="notification-icon"><i class="fa fa-eye" aria-hidden="true"></i></span>';
                    var shoppingCartIcon = '<span class="notification-icon"><i class="fa fa-shopping-bag" aria-hidden="true"></i></span>';

                    switch (type) {
                        case wiijetConsts.NOTIFICATION_TYPE.ACTIVE_VIEWS:
                            return eyeIcon + message;
                        case wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES:
                            return shoppingCartIcon + message;
                        default:
                            throw new Error('Unsupported notification type found');
                    }
                }
            }
        }
    }
}

module.exports = {
    digestDataAndGetStatistics: digestDataAndGetStatistics
};