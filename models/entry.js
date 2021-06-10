const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const entrySchema = new Schema({
    entrant: {
        type: String,
        required: true
    },
    tier1golfer: {
        type: String,
        required: true
    },
    tier2golfer: {
        type: String,
        required: true
    },
    tier3golfer: {
        type: String,
        required: true
    },
    tier4golfer: {
        type: String,
        required: true
    },
    tiebreaker: {
        type: String,
        required: true
    }
}, { timestamps: true });

const Entry = mongoose.model('Entry', entrySchema);
module.exports = Entry;