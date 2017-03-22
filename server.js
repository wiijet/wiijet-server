//
// # SimpleServer
//
// A simple chat server using Socket.IO, Express, and Async.
//
var http = require('http');
var _ = require('lodash');
var path = require('path');
var cors = require('cors');
var express = require('express');
var bodyParser = require('body-parser')
var validator = require('express-validator');
var mongoose = require('mongoose');
var router = require('./router');

mongoose.connect(process.env.MONGODB_URI, { config: { autoIndex: false } });

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
    // we're connected!
    console.log('DB connected successfully');
});
//
// Creates a new instance of SimpleServer with the following options:
//  * `port` - The HTTP port to listen on. If `process.env.PORT` is set, _it overrides this value_.
//
var app = express();
var server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());
app.use(validator()); // this line must be immediately after any of the bodyParser middlewares!
app.use(express.static(path.join(__dirname, 'public')));
// Add headers
app.use(function(req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', false);
    // Pass to next layer of middleware
    next();
});
// Our routes
app.use(router);

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function() {
    var addr = server.address();
    console.log("Wiijet server listening at", addr.address + ":" + addr.port);
});
