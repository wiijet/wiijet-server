// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Product = require('./product');
var wiijetConsts = require('../config.json').CONSTS;
var _ = require('lodash');

var userSchema = new Schema({
    id: {
        type: String,
        unique: true,
        index: true
    },
    emailAddress: String,
    cart: {
        products: [{
            id: String,
            quantity: Number,
            wasAddedDuringControlGroup: Boolean
        }]
    }
});

userSchema.methods.saveAddedToCartProduct = function (product, qty, cb) {
    try {
        // Check if product already exists in cart and if it does just increment quantity and check if was added during a control group
        var existingProductInCart = _.find(this.cart.products, {
            id: product.id
        });

        if (existingProductInCart) {
            existingProductInCart.quantity++;
            existingProductInCart.wasAddedDuringControlGroup = existingProductInCart.wasAddedDuringControlGroup || this.inControlGroup;
        } else {
            this.cart.products.push({
                id: product.id,
                quantity: qty,
                wasAddedDuringControlGroup: this.inControlGroup
            });
        }

        this.save(function (err, savedUser) {
            if (err) {
                cb(err);
            }

            cb(null, savedUser);
        });
    } catch (e) {
        cb(e);
    }
};
// Clear added to cart products on checkout
userSchema.methods.clearAddedToCartProducts = function (cb) {
    try {
        console.log('Clearing cart during checkout for user ', this.id, ' with cart ', this.cart.products);

        this.cart.products = [];

        this.save(function (err, savedUser) {
            if (err) {
                cb(err);
            }

            cb(null, savedUser);
        });
    } catch (e) {
        cb(e);
    }
};

var User = mongoose.model('User', userSchema);

module.exports = User;