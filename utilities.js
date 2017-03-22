// var bluebird = require('bluebird');
var redis = require('redis');
var _ = require('lodash');
var wiijetConsts = require('./config.json').CONSTS;

// bluebird.promisifyAll(redis.RedisClient.prototype);
// bluebird.promisifyAll(redis.Multi.prototype);

var redisClient = redis.createClient({
    url: process.env.REDIS_URL,
    retry_strategy: function (options) {
        if (options.error && options.error.code === 'ECONNREFUSED') {
            // End reconnecting on a specific error and flush all commands with a individual error
            return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands with a individual error
            return new Error('Retry time exhausted');
        }
        if (options.times_connected > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
    }
});

redisClient.on('connect', function (err) {
    console.log('Redis connected successfully');
});

redisClient.on('error', function (err) {
    console.error('Error connecting redis ' + err);
});


function randomizeControlGroup(cb) {
    redisClient.mget('usersInsideControlGroup', 'usersOutsideControlGroup',
        function (err, values) {
            if (err) {
                throw new Error('Something bad happend while pulling data from redis', err);
            }

            console.log('got response from redis ', values);

            var usersInsideControlGroup = values[0] || 0,
                usersOutsideControlGroup = values[1] || 0;

            console.log('usersInsideControlGroup - ', usersInsideControlGroup);
            console.log('usersOutsideControlGroup - ', usersOutsideControlGroup);

            if (usersInsideControlGroup === usersOutsideControlGroup) {
                if (Math.random() < 0.5) {
                    return incrementControlGroupValue('usersInsideControlGroup', usersInsideControlGroup, function () {
                        cb(null, true);
                    });
                }

                return incrementControlGroupValue('usersOutsideControlGroup', usersOutsideControlGroup, function () {
                    cb(null, false);
                });
            }

            var totalNumOfUsers = usersInsideControlGroup + usersOutsideControlGroup;

            if ((wiijetConsts.CONTROL_GROUP.PERCENTAGE_OF_USERS_IN_CONTROL_GROUP * totalNumOfUsers / 100) - usersInsideControlGroup >
                ((100 - wiijetConsts.CONTROL_GROUP.PERCENTAGE_OF_USERS_IN_CONTROL_GROUP) * totalNumOfUsers / 100) - usersOutsideControlGroup) {
                console.log('Decided to have the user inside control group');
                console.log('Users inside control group: ', usersInsideControlGroup, ' users outside control group: ', usersOutsideControlGroup);

                return incrementControlGroupValue('usersInsideControlGroup', usersInsideControlGroup, function () {
                    cb(null, true);
                });
            }

            return incrementControlGroupValue('usersOutsideControlGroup', usersOutsideControlGroup, function () {
                console.log('Decided to have the user outside control group');
                console.log('Users inside control group: ', usersInsideControlGroup, ' users outside control group: ', usersOutsideControlGroup);

                cb(null, false);
            });

            function incrementControlGroupValue(key, value, cb) {
                console.log('Settings key value in redis', key, value);

                redisClient.set(key, ++value, function (err, value) {
                    if (err) {
                        throw new Error(err);
                    }

                    console.log('Successfully set control group value in redis', key, value);

                    cb();
                });
            }
        });
}

module.exports = {
    randomizeControlGroup: randomizeControlGroup
};