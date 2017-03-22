// get an instance of router
var express = require('express');
var router = express.Router();
var url = require('url');
var mongoose = require('mongoose');
var locale = require('locale');
var _ = require('lodash');
// wiijet libs
var Models = require('./model/models');
var Utilities = require('./utilities');
var User = Models.User;
var wiijetConfig = require('./config.json');
var wiijetConsts = wiijetConfig.CONSTS;
var supportedLocales = new locale.Locales([wiijetConsts.SUPPORTED_LOCALES]);
var statisticsEngine = require('./statisticsEngine');
var encodedWiijetConfig = encodeB64String(JSON.stringify(wiijetConfig));

router.get('/api/*', function (req, res, next) {
    try {
        var query = url.parse(req.url, true).query;

        console.log('Received encoded query', query);

        req.query = JSON.parse(unescape(decodeB64String(query.data)));

        console.log('Decoded query is', req.query);

        next();
    } catch (e) {
        var errStr = 'Caught exception while parsing query data ' + e;

        handleError(res, errStr, 400);
    }
});

router.get('/api/session/', function (req, res) {
    try {
        var query = req.query;
        var client = query.client;

        var returnedUserProjectionFieldsArr = ['id'];
        var returnedUserProjectionFields = returnedUserProjectionFieldsArr.join(' ');

        console.log('Use requesting session ', query, client);

        var clientID = client.id || encodeB64String(client.GAClientID);

        User.findOne({
            id: clientID
        }, returnedUserProjectionFields, findUserOrCreateHandler);
    } catch (e) {
        var errStr = 'Caught exception ' + e;

        handleError(res, errStr, 500);
    }

    function findUserOrCreateHandler(err, user) {
        // create a new user
        if (!user) {
            var userDataObject = {
                id: clientID
            };

            if (client.emailAddress) {
                userDataObject.emailAddress = client.emailAddress;
            }

            User.create(userDataObject, function (err, newUser) {
                if (err) throw err;

                newUser = newUser.toObject();

                var returnedNewUser = _.pick(newUser, returnedUserProjectionFieldsArr);

                assignControlGroup(returnedNewUser, function () {
                    console.log('returning newly created user back to client', returnedNewUser);

                    res.status(200).json(returnedNewUser);
                });
            });

        } else {
            user = user.toObject();

            // we have the updated user returned to us
            console.log('user already exists ', user);

            assignControlGroup(user, function () {
                console.log('returning updated user back to client', user);

                res.status(200).json(user);
            });
        }
    }

    function assignControlGroup(userObject, cb) {
        console.log('Assigning control group for user', userObject);

        Utilities.randomizeControlGroup(function (err, inControlGroup) {
            userObject.inControlGroup = inControlGroup || false;

            console.log('Assigned control group value -', userObject.inControlGroup, userObject);

            cb();
        });
    }
});

// route middleware to validate client id and update user email address if possible
router.use(function (req, res, next) {
    try {
        console.log('Received query ', req.query);

        var client = req.query.client;

        console.assert(client && client.id, 'Got no wiijet client id specified');

        req.client = client;

        User.findOne({
            id: client.id
        }, findUserResultHandler);
    } catch (e) {
        handleError(res, 'Invalid params - one or more params are missing', 400);
    }

    function findUserResultHandler(err, user) {
        if (err) throw err;

        // show the one user
        console.log('user referring api ', user);

        // Update user email address if found any and doesn't have yet
        if (!user.emailAddress && req.client.emailAddress) {
            try {
                user.update({
                    emailAddress: req.client.emailAddress
                }, updatedUserHandler);
            } catch (e) {
                var errStr = 'Could not update user info ' + e;

                handleError(res, errStr, 500);
            }
        } else {
            if (user.emailAddress && req.client.emailAddress && user.emailAddress !== req.client.emailAddress) {
                console.warn('Found wiijet client with more than one known email address, need to store both(?)');
            }

            setReferringUserAndContinue(user);
        }

        function updatedUserHandler(err) {
            if (err) throw err;

            setReferringUserAndContinue(user);
        }

        function setReferringUserAndContinue(user) {
            console.log('setReferringUserAndContinue user is - ', user);

            var referringUser = user;
            // Use the requesting client "inControlGroup" value instead of using the one from the DB (to support scenario of a user connected from more than one device)
            referringUser.inControlGroup = req.client.inControlGroup;

            var locales = new locale.Locales(req.headers['wiijet-accept-language'] || req.headers['accept-language']);

            req.clientMetaData = {
                referringUser: referringUser,
                clientLocale: locales.best(supportedLocales)
            };

            next();
        }
    }
});

// Retrieve wiijet configuration
router.get('/api/configuration/', function (req, res) {
    try {
        console.log('Configuration requested from client', req.client.id);

        res.status(200).json(encodedWiijetConfig);
    } catch (e) {
        var errStr = 'Caught exception ' + e;

        handleError(res, errStr, 500);
    }
});

// Retrieve wiijet statistics
router.get('/api/track/', function (req, res) {
    try {
        var query = req.query;
        var referringUser = req.clientMetaData.referringUser;
        var clientLocale = req.clientMetaData.clientLocale;

        console.assert(referringUser, 'Found invalid referring user');

        console.log('Received statistics request for page', query.data);
        console.log('From user ', referringUser, ' with locale ', clientLocale);

        if (!query.data) {
            return handleError(res, 'Missing query params', 400);
        }

        statisticsEngine.digestDataAndGetStatistics(query, req.clientMetaData, statisticsResultHandler);
    } catch (e) {
        var errStr = 'Caught exception ' + e;

        handleError(res, errStr, 500);
    }

    function statisticsResultHandler(err, result) {
        if (err) {
            throw err;
        }

        console.log('Returning statistics ', result, ' for page ', query);

        res.status(200).json(result || {});
    }
});

module.exports = router;

// Generic error handler used by all endpoints.
function handleError(res, message, code) {
    console.log('ERROR: ' + message);

    res.status(code || 500).json({
        "error": message
    });
}

function encodeB64String(str) {
    if (!str) {
        return '';
    }

    return new Buffer(str, 'ascii').toString('base64');
}

function decodeB64String(str) {
    if (!str) {
        return '';
    }

    return new Buffer(str, 'base64').toString('ascii');
}