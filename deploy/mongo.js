"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoCollectionHost = void 0;
const mongodb_1 = require("mongodb");
const fs_1 = require("fs");
const arguments_resolver_1 = __importDefault(require("./arguments-resolver"));
const stdin_json_reader_1 = __importDefault(require("./stdin-json-reader"));
const args = arguments_resolver_1.default.resolve();
class MongoDatabaseConnectionFactory {
    static async create() {
        let connectionUri = "";
        if (!args.uri) {
            connectionUri = MongoDatabaseConnectionFactory.useDefaultConnectionUri();
            console.log("Switched to a default uri: ", connectionUri);
        }
        else
            connectionUri = args.uri;
        MongoDatabaseConnectionFactory.checkDatabaseNameKnown(args.db);
        const client = await new mongodb_1.MongoClient(connectionUri, {
            connectTimeoutMS: 1000
        }).connect();
        const db = await client.db(args.db);
        //const dbConnected = await db.command({ping: 1});
        return {
            client: client,
            database: db
        };
    }
    static checkDatabaseNameKnown(name) {
        if (!name)
            throw new Error("Please provide target mongo db name. Start app with db-[db name] parameter");
    }
    static useDefaultConnectionUri() {
        return "mongodb://127.0.0.1:27017/";
    }
}
class MongoCollectionHost {
    async feed() {
        if (args.idType) {
            const idRandomizer = IdRandomizerFactory.randomizer(args.idType);
            const uniqueIds = idRandomizer.randomize([10, 20], 10);
            console.log("Unique ids are:", uniqueIds);
        }
        if (args.randomize) {
            this.feedRandomized();
        }
        return;
    }
    /**
     * If a user didn't make decision about which idType he is to use for his documents' keys,
     * default id randomizer will be used. Default id randomizer operates on integer values.
     */
    async feedRandomized() {
        const dbConnection = await this.doDatabaseConnection();
        const excludedIds = (await dbConnection.database.collection(args.coll).find({}, { projection: { _id: 1 } })
            .toArray())
            .map(doc => {
            const id = doc._id.id.toString();
            if (args.idType == "string")
                return id;
            try {
                return parseInt(id);
            }
            catch (er) {
                return 0;
            }
        });
        const _feed = await this.readFeed();
        this.checkIfFeedContainsMentionedCollection(_feed, args.coll);
        const insertAllWithNumericId = async () => {
            const idRandomizer = IdRandomizerFactory.default();
            const randoms = idRandomizer.randomize(excludedIds, this.countIn(_feed, args.coll));
            this.includeRandomizedIds(_feed, randoms);
            dbConnection.database.collection(args.coll).insertMany(_feed[args.coll]);
        };
        if (args.idType) {
            if (args.idType === "numeric") {
                insertAllWithNumericId();
            }
        }
        else {
            insertAllWithNumericId();
        }
    }
    /**
     * This function is to populate provided documents with random ids.
     * @param feed
     * @param randomIds
     */
    includeRandomizedIds(feed, randomIds) {
        const newCollection = feed[args.coll];
        for (let i = 0; i < randomIds.length; i++) {
            newCollection[i]._id = randomIds[i];
        }
    }
    /**
     * This function is to count every furture document in the collection.
     * This way, number of the needed random ids (id => document's key) is known beforehand,
     * provided that user wanted to populate collection with documents with random, unique ids.
     * @param feed
     * @param collection
     * @returns
     */
    countIn(feed, collection) {
        return Object.keys(feed[collection]).length;
    }
    async doDatabaseConnection() {
        return await MongoDatabaseConnectionFactory.create();
    }
    checkIfCollectionIsKnown(collection) {
        if (!collection)
            throw new Error("Collection is unknown. Start app with coll--[collection name] parameter");
    }
    checkIfFeedContainsMentionedCollection(feed, collection) {
        if (!(collection in feed))
            throw new Error("Feed doesn't mention about collection. Collection argument --coll must be consent with collection property name within a file");
    }
    async readFeed() {
        if (args.feed) {
            if (!(0, fs_1.existsSync)(args.feed))
                throw new Error("Feed is not available. Provided feed file is not available");
            const _feed = (0, fs_1.readFileSync)(args.feed);
            try {
                const _feedObj = JSON.parse(_feed.toString());
                return _feedObj;
            }
            catch (ex) {
                throw new Error("Feed file is empty!");
            }
        }
        return stdin_json_reader_1.default.tryRead();
    }
}
exports.MongoCollectionHost = MongoCollectionHost;
class IdRandomizerFactory {
    static randomizer(type) {
        if (type === 'numeric')
            return new NumericIdRandomizer();
        return new NumericIdRandomizer();
    }
    static default() {
        return new NumericIdRandomizer();
    }
}
class NumericIdRandomizer {
    randomize(excluded, qty) {
        if (!excluded || excluded.length == 0) {
            if (!qty || qty == 0)
                return Math.floor(Math.random() * 100);
            const uniqueNumbers = {};
            let uniques = 0;
            let lastUnique = 0;
            while (uniques < qty) {
                let unique = Math.floor(Math.random() * 1000 + lastUnique);
                if (uniqueNumbers[unique])
                    continue;
                uniqueNumbers[lastUnique = unique] = 1;
                uniques++;
            }
            return Object.keys(uniqueNumbers).map(key => parseInt(key));
        }
        else {
            const excludedCopy = Array.from(excluded);
            excludedCopy.sort((first, second) => first > second ? 1 : first < second ? -1 : 0);
            const excludedNumbers = {};
            excluded.forEach(ex => excludedCopy[ex] = 1);
            if (!qty || qty == 0 || qty == 1) {
                let unique = 0;
                do {
                    unique = Math.floor(Math.random() * 1000) + excludedCopy[excludedCopy.length - 1];
                } while (excludedNumbers[unique]);
                return unique;
            }
            else {
                const uniqueNumbers = {};
                let uniques = 0;
                while (uniques < qty) {
                    let unique = Math.floor(Math.random() * 1000 + excludedCopy[excludedCopy.length - 1]);
                    if (uniqueNumbers[unique] || excludedNumbers[unique])
                        continue;
                    uniqueNumbers[unique] = 1;
                    uniques++;
                }
                return Object.keys(uniqueNumbers).map(key => parseInt(key));
            }
        }
    }
}
