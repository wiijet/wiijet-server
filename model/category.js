var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var categorySchema = new Schema({
    id: {
        type: String,
        unique: true,
        index: true
    },
    url: String,
    title: String,
    productIDs: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    childCategoryIDs: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    parentCategory: { type: Schema.Types.ObjectId, ref: 'Category' }
});

var Category = mongoose.model('Category', categorySchema);

module.exports = Category;
