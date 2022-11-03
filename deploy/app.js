"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongo_1 = require("./mongo");
const doFeed = async () => {
    const collectionHost = new mongo_1.MongoCollectionHost();
    try {
        await collectionHost.feed();
    }
    catch (error) {
        console.log("Fatal error: ", error);
    }
};
doFeed();
