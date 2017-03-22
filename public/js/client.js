var WIIJET_URL = 'https://wiijet-api.herokuapp.com';
var WIIJET_API_URL = WIIJET_URL + '/api';
var WIIJET_CONFIGURATION_URL = WIIJET_API_URL + '/configuration/';
var WIIJET_STATISTICS_API_URL = WIIJET_API_URL + '/track/';
var WIIJET_SESSION_API_URL = WIIJET_API_URL + '/session/';
var WIIJET_JQUERY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.0/jquery.min.js';
var WIIJET_WAIT_FOR_LOAD_TIMEOUT = 2000;
var jsResourceObjects = [{
    url: 'https://use.fontawesome.com/a572864c0b.js'
}, {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery-noty/2.4.1/packaged/jquery.noty.packaged.min.js'
}, {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/q.js/0.9.2/q.min.js'
}, {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/js-cookie/2.1.3/js.cookie.min.js'
}];
var _wjtConfigurationKey = '_wjtConf';
var _wjtCookieKey = '_wjtClientID';
var _wijClient;
var hasGALoaded = false;
var wiijetLoaded = false;
var wiijetNotificationYOffset;
var wiijetConfig, wiijetConsts;

document.addEventListener('DOMContentLoaded', function (event) {
    onWiijetHostLoaded();
});

window.onresize = function () {
    setWiijetNotificationStyles();
};

function onWiijetHostLoaded() {
    console.debug('on load called');

    if (!wiijetLoaded) {
        wiijetLoaded = true;

        if (window.ga && ga.create) {
            // Hooray! Analytics is present!
            hasGALoaded = true;
        }

        injectWiijetCSSResources();
        injectWiijetJSResources();
    }
}

setTimeout(function () {
    console.debug('Host loading timeout has passed, checking if wiijet hasn\'t been loaded yet');

    onWiijetHostLoaded();
}, WIIJET_WAIT_FOR_LOAD_TIMEOUT);

function initWiijet() {
    setNotificationDefaults();
    setWiijetNotificationStyles();

    identifyUser().done(function () {
        console.log('identified user, wiijetClient: ', _wijClient);
        getWiijetConfiguration().then(function () {
            if (isProductPage()) {
                console.log('recognized product page, getting stats');

                wiijetizeCurrentPageAndGetStatistics();
            }
        });
    });
}

function setNotificationDefaults() {
    jQuery.noty.defaults = {
        layout: 'bottomRight',
        theme: 'relax', // or relax
        type: 'notification', // success, error, warning, information, notification
        text: '', // [string|html] can be HTML or STRING

        dismissQueue: true, // [boolean] If you want to use queue feature set this true
        force: false, // [boolean] adds notification to the beginning of queue when set to true
        maxVisible: 5, // [integer] you can set max visible notification count for dismissQueue true option,

        template: '<div class="wiijet-notification"><span class="noty_text"></span><div class="noty_close"></div></div>',

        timeout: 4000, // [integer|boolean] delay for closing event in milliseconds. Set false for sticky notifications
        progressBar: false, // [boolean] - displays a progress bar

        animation: {
            open: {
                height: 'toggle'
            }, // or Animate.css class names like: 'animated bounceInLeft'
            close: {
                height: 'toggle'
            }, // or Animate.css class names like: 'animated bounceOutLeft'
            easing: 'swing',
            speed: 500 // opening & closing animation speed
        },
        closeWith: ['click'], // ['click', 'button', 'hover', 'backdrop'] // backdrop click will close all notifications

        modal: false, // [boolean] if true adds an overlay
        killer: false, // [boolean] if true closes all notifications and shows itself

        callback: {
            onShow: function () {},
            afterShow: function () {},
            onClose: function () {},
            afterClose: function () {},
            onCloseClick: function () {},
        },

        buttons: false // [boolean|array] an array of buttons, for creating confirmation dialogs.
    };
}

function getWiijetConfiguration() {
    return wiijetHTTPRequest(WIIJET_CONFIGURATION_URL, {
        method: 'GET'
    }).then(function (data) {
        var config = data;

        console.assert(config, 'No config was returned from server');
        console.log('Received config from server', config);

        wiijetConfig = JSON.parse(atob(config));
        wiijetConsts = wiijetConfig.CONSTS;
    });
}

// Get the most relevant info out of the supported pages (currently product / category)
function getParsedViewedPageDataAccordingToEvent(eventType) {
    var parsedPageDataObject = {
            eventType: eventType
        },
        eventData = {
            url: location.href
        };

    switch (eventType) {
        case wiijetConfig.CONSTS.EVENT_TYPE.PAGE_VIEW:
            if (isProductPage()) {
                // pageData.pageType = wiijetConfig.CONSTS.PAGE_TYPE.PRODUCT;
                // for later use
                // breadcrumbs: [],
                // name: jQuery('*[itemprop="name"]').text(),
                eventData.inStock = jQuery('p[class*="out-of-stock"]').length ? false : true;
                eventData.price = jQuery('*[itemprop="price"]').attr('content');
                // priceCurrency: jQuery('*[itemprop="priceCurrency"]').attr('content'),
                // imageURL: jQuery('*[itemprop="image"]').attr('href')

                // var priceBefore = getParsedPriceBefore();

                // if (priceBefore) {
                //   pageData.relatedProductInfo.priceBefore = priceBefore;
                // }
            }
            break;
        case wiijetConfig.CONSTS.EVENT_TYPE.ADD_TO_CART:
            eventData.quantity = jQuery('form[class="cart"] input[name="quantity"]').val() || 1;
            break;
        case wiijetConfig.CONSTS.EVENT_TYPE.PURCHASE:
            break;
            // case 'pur':
            //     var jQuery('.cart_item .product-name').clone() //clone the element
            //         .children() //select all the children
            //         .remove() //remove all the children
            //         .end() //again go back to selected element
            //         .text().trim();
        default:
            console.warn('Unsupported event type found');
            return null;
    }


    // else if (isProductsCategoryPage()) {
    //     pageData.pageType = wiijetConfig.CONSTS.PAGE_TYPE.CATEGORY;
    // } else {
    //     // Unsupported page
    //     pageData.pageType = wiijetConfig.CONSTS.PAGE_TYPE.UNSUPPORTED;
    // }

    // pageData.breadcrumbs = getParsedBreadcrumbs();
    parsedPageDataObject.data = eventData;

    return parsedPageDataObject;
}

// function getParsedPriceBefore() {
//     var priceBeforeElement = jQuery('*[itemprop="offers"] del .amount');

//     if (!priceBeforeElement) {
//         return null;
//     }

//     return !isNaN(priceBeforeElement.contents()[1].data) ? priceBeforeElement.contents()[1].data : null;
// }

// function getParsedBreadcrumbs() {
//     var possibleBreadcrumbs = jQuery('*[itemprop="breadcrumb"] > a').length > 0 ? jQuery('*[itemprop="breadcrumb"] > a') : jQuery('*[class*="breadcrumb"] > a');

//     var parsedBreadcrumbs = [];

//     if (possibleBreadcrumbs.length) {
//         possibleBreadcrumbs.each(
//             function() {
//                 var href = jQuery(this).attr('href');

//                 // Don't take first breadcrumb which is the homepage (usually)
//                 if (href.indexOf('/') !== -1) {
//                     parsedBreadcrumbs.push(href);
//                 }
//             });
//     }

//     return parsedBreadcrumbs;
// }

// function getParsedListedProductData(productDOMElement) {
//     if (!productDOMElement) {
//         return null;
//     }

//     // var price = productDOMElement.find('.price').text();
//     // var priceSymbol = price[0];

//     // price = price.substr(1);

//     var parsedData = {
//         // name: productDOMElement.find('h3').first().text(),
//         url: productDOMElement.find('a').first().attr('href'),
//         // price: price,
//         // symbol: priceSymbol === '₪' ? 'ils' : 'no-symbol'
//     }

//     return parsedData;
// }

function productAddedToCartHandler() {
    var data = getParsedViewedPageDataAccordingToEvent(wiijetConfig.CONSTS.EVENT_TYPE.ADD_TO_CART);

    if (data) {
        console.log('product added to cart event data', data);

        getStatisticsForPage(data).then(function (data) {
            // wiselyReflectDataToUser(data);
        });
    }
}

function listenToAddToCartEvents() {
    // listen to add to cart in category page and product page (suggested similar products below the main product)
    // jQuery('*[href*="add-to-cart"]').each(function() {
    //     jQuery(this).click(function() {
    //         // TODO: Save the main product page that the related products where bought from (for stats)
    //         var parsedProductData = getParsedListedProductData(jQuery(this).closest('li'));

    //         productAddedToCartHandler(parsedProductData);
    //     })
    // });

    // listen to add to cart if in main product page
    if (isProductPage()) {
        var addToCartFormDOMElement = jQuery('form[class="cart"]');

        if (addToCartFormDOMElement) {
            addToCartFormDOMElement.submit(productAddedToCartHandler);
        }
    }
}

function listenToCheckoutEvents() {
    var possibleCheckoutButtonElement = jQuery('input[name="woocommerce_checkout_place_order"][type="submit"]');

    if (!possibleCheckoutButtonElement.length) {
        possibleCheckoutButtonElement = jQuery('*[class="woocommerce-checkout-payment"] input[type="submit"]');
    }

    if (!possibleCheckoutButtonElement.length) {
        console.log('Probably not a checkout page');
        return;
    }

    possibleCheckoutButtonElement.submit(productAddedToCartHandler);
}

function wiijetizeCurrentPageAndGetStatistics() {
    listenToAddToCartEvents();
    listenToCheckoutEvents();

    var data = getParsedViewedPageDataAccordingToEvent(wiijetConfig.CONSTS.EVENT_TYPE.PAGE_VIEW);

    if (data) {
        console.log('product view event data', data);

        getStatisticsForPage(data).then(function (data) {
            wiselyReflectDataToUser(data);
        }, function (err) {});
    }
}

function isProductPage() {
    return location.pathname.split('/')[1] === 'product';
}

function isProductsCategoryPage() {
    return location.pathname.indexOf('category') > -1 || location.pathname.indexOf('brand') > -1;
}

function wiselyReflectDataToUser(notificationData) {
    var notificationHTML = notificationData.data;

    console.log('received stats data from server', notificationData);

    if (isProductPage() && notificationData.type !== undefined) {
        switch (notificationData.type) {
            case wiijetConsts.NOTIFICATION_TYPE.ACTIVE_VIEWS:
                createNotification(notificationHTML);
                break;
            case wiijetConsts.NOTIFICATION_TYPE.LAST_PURCHASES:
                createNotification(notificationHTML);
                break;
        }
    }
}

function getStatisticsForPage(data) {
    console.log('requesting statistics for page', data);

    return wiijetHTTPRequest(WIIJET_STATISTICS_API_URL, {
        method: 'GET'
    }, data).then(function (data) {
        console.debug('Succesfully retrieved statistics', data);

        return data;
    }, function (err) {
        console.debug('Couldn\'t retrieve statistics');

        return err;
    });
}

function injectWiijetCSSResources() {
    var head = document.head || document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0],
        linkElement;

    var cssFilePaths = [WIIJET_URL + '/css/client.css'];

    cssFilePaths.forEach(function (path) {
        linkElement = document.createElement('link');
        linkElement.href = path;
        linkElement.type = "text/css";
        linkElement.rel = "stylesheet";
        linkElement.media = "screen,print";
        head.appendChild(linkElement);
    });
}

function hasResourcesLoaded(resourceObjects) {
    if (!Array.isArray(resourceObjects)) {
        if (resourceObjects.dependentResources && resourceObjects.dependentResources.length && resourceObjects.loaded) {
            return hasResourcesLoaded(resourceObjects.dependentResources);
        }

        return resourceObjects.loaded;
    }

    var loaded = true;

    resourceObjects.forEach(function (resource) {
        loaded = loaded && hasResourcesLoaded(resource);
    });

    return loaded;
}

function wiijetResourceLoadedCallback(resource) {
    resource.loaded = true;

    if (hasResourcesLoaded(jsResourceObjects)) {
        console.log('WIIJET - loaded all resources, initiating wiijet');
        initWiijet();
    }
}

function loadScript(url, callback) {
    var head = document.head || document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0];
    var script = document.createElement("script");
    script.type = "text/javascript";
    if (script.readyState) { //IE
        script.onreadystatechange = function () {
            if (script.readyState === "loaded" || script.readyState === "complete") {
                script.onreadystatechange = null;
                callback();
            }
        };
    } else { //Others
        script.onload = function () {
            callback();
        };
    }

    script.src = url;

    head.appendChild(script);
}

function injectWiijetJSResources() {
    function loadResources(resourceObjects) {
        resourceObjects.forEach(function (resourceObj) {
            console.log('WIIJET - loading resource ', resourceObj.url);

            loadScript(resourceObj.url, function () {
                console.log('WIIJET - loaded resource ', resourceObj.url);

                resourceObj.loaded = true;

                if (resourceObj.dependentResources && resourceObj.dependentResources.length) {
                    loadResources(resourceObj.dependentResources);
                } else {
                    wiijetResourceLoadedCallback(resourceObj);
                }
            });
        });
    }

    if (typeof jQuery == 'undefined') {
        console.log('WIIJET - jquery wasn\'t found, loading it now.');
        loadScript(WIIJET_JQUERY_URL, function () {
            console.log('WIIJET - JQuery loaded. Continuing to other dependencies');
            loadResources(jsResourceObjects);
        });
    } else {
        loadResources(jsResourceObjects);
    }
}

function createNotification(contentHTML) {
    var liveWatchersNotification = noty({
        text: contentHTML
    });
}

function identifyUser() {
    var userIdentity = {
        client: {}
    };

    var wiijetClientID = Cookies.get(_wjtCookieKey);

    console.log('wiijet cookie', wiijetClientID);

    if (wiijetClientID) {
        userIdentity.client.id = wiijetClientID;

        return acquireWiijetSession(userIdentity);
    }

    return getGAClientID().then(function (clientID) {
        if (clientID) {
            console.debug('found GA clientID', clientID);

            userIdentity.client.GAClientID = clientID;
        } else {
            console.debug('Couldn\'t find GA client ID');
        }

        return acquireWiijetSession(userIdentity);
    }, function (err) {
        console.debug('Something bad happend while trying to get GA client ID', err);
    });
}

function getGAClientID() {
    var deferred = Q.defer();

    if (hasGALoaded) {
        ga(function (tracker) {
            var clientId = tracker.get('clientId');

            deferred.resolve(clientId);
        });
    } else {
        console.debug('GA hasn\'t been loaded (yet)');

        deferred.resolve(null);
    }

    return deferred.promise;
}

function acquireWiijetSession(userIdentity) {
    return wiijetHTTPRequest(WIIJET_SESSION_API_URL, {
        method: 'GET',
    }, userIdentity).then(function (data) {
        console.log('got wiijet session ', data);

        if (data && Object.keys(data).length) {
            _wijClient = data;

            Cookies.set(_wjtCookieKey, _wijClient.id);
        }
    }, function (err) {
        console.log('got an error while trying to retrieve wiijet session ', err);
    });
}

function wiijetHTTPRequest(url, options, data) {
    options = options || {};
    options.dataType = 'json';

    options.headers = {};
    options.headers['wiijet-accept-language'] = jQuery('html').attr('lang');

    data = data || {};

    data.client = data.client || _wijClient || {};

    if (options.method !== 'GET') {
        options.contentType = 'application/json; charset=utf-8';
    }

    var possibleEmailAddress = jQuery('input[name="EMAIL"]').val();

    if (!data.client.emailAddress && possibleEmailAddress) {
        data.client.emailAddress = possibleEmailAddress;
    }

    if (data) {
        options.data = {
            data: btoa(escape(JSON.stringify(data)))
        };
    }

    return jQuery.ajax(url, options).then(function (data) {
        console.debug('got data from server ', data);

        return data;
    }, function (err) {
        console.log('got an error while trying to retrieve data ', err);
    });
}

function setWiijetNotificationStyles() {
    var possibleStickToBottomElement = jQuery('*[style*="position: absolute"], [style*="bottom: 0"]');


    wiijetNotificationYOffset = 5;

    if (jQuery('head > #noty_bottomRight_layout_container').length) {
        jQuery('head > #noty_bottomRight_layout_container').remove();
    }

    if (possibleStickToBottomElement.length) {
        wiijetNotificationYOffset += possibleStickToBottomElement.height();

        jQuery('head').append('<style type="text/css">#noty_bottomRight_layout_container { bottom: ' + wiijetNotificationYOffset + 'px !important;right: 10px !important;}</style>');
    }

    // if (!jQuery('head > .wiijet-notification').length) {
    //     var backgroundColor = jQuery('body').css('background-color') || '#ffff';

    //     jQuery('head').append('<style type="text/css">.wiijet-notification { background-color: ' + backgroundColor + '; }</style>');
    // }
}