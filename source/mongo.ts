import { Db, MongoClient } from "mongodb";
import { existsSync, readFileSync } from "fs"
import ArgumentResolver from "./arguments-resolver";
import StdinJsonReader from "./stdin-json-reader";


type MongoDatabaseConnectionWrapper = {
    client: MongoClient,
    database: Db
}

const args = ArgumentResolver.resolve();

class MongoDatabaseConnectionFactory {

    static async create(): Promise<MongoDatabaseConnectionWrapper> {
        
        let connectionUri = "";
        
        if(!args.uri) {
            connectionUri = MongoDatabaseConnectionFactory.useDefaultConnectionUri();
            console.log("Switched to a default uri: ", connectionUri);
        }
        else connectionUri = args.uri;
        

        MongoDatabaseConnectionFactory.checkDatabaseNameKnown(args.db);

        const client = await new MongoClient(connectionUri, {
            connectTimeoutMS: 1000
        }).connect();
        const db = await client.db(args.db);
        //const dbConnected = await db.command({ping: 1});
        return {
            client: client,
            database: db
        }
    }

    private static checkDatabaseNameKnown(name: string) {
        if(!name) throw new Error("Please provide target mongo db name. Start app with db-[db name] parameter");
    }

    private static useDefaultConnectionUri() {
        return "mongodb://127.0.0.1:27017/";
    }
}

class MongoCollectionHost {
    
    async feed() {
        if(args.idType) {
            const idRandomizer = IdRandomizerFactory.randomizer(args.idType);
            const uniqueIds = idRandomizer.randomize([10, 20], 10);
            console.log("Unique ids are:", uniqueIds);
        }
        if(args.randomize) {
            this.feedRandomized();
        }
        return;
    }

    /**
     * If a user didn't make decision about which idType he is to use for his documents' keys,
     * default id randomizer will be used. Default id randomizer operates on integer values.
     */
    private async feedRandomized() {
        const dbConnection = await this.doDatabaseConnection();
        const excludedIds = (await dbConnection.database.collection(args.coll).find({}, { projection: {_id: 1} })
                                                                        .toArray())
                                                                        .map(doc => {
                                                                            const id = doc._id.id.toString();
                                                                            if(args.idType == "string") return id;
                                                                            try {
                                                                                return parseInt(id)
                                                                            } catch( er ) {
                                                                                return 0;
                                                                            }
                                                                        })
        const _feed = await this.readFeed()
        this.checkIfFeedContainsMentionedCollection(_feed, args.coll);
       
        const insertAllWithNumericId = async () => {
            const idRandomizer = IdRandomizerFactory.default();
            const randoms = idRandomizer.randomize(excludedIds as number[], this.countIn(_feed, args.coll));
            this.includeRandomizedIds(_feed, randoms);
            dbConnection.database.collection(args.coll).insertMany(_feed[args.coll]);
        }

        if(args.idType) {
            if(args.idType === "numeric") {
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
    private includeRandomizedIds(feed: any, randomIds: number[]) {
        const newCollection = feed[args.coll] as any[];
        for(let i = 0; i < randomIds.length; i++) {
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
    private countIn(feed: any, collection: string) {
        return Object.keys(feed[collection]).length;
    }

    private async doDatabaseConnection(): Promise<MongoDatabaseConnectionWrapper> {
        return await MongoDatabaseConnectionFactory.create();
    }

    private checkIfCollectionIsKnown(collection: string) {
        if(!collection) throw new Error("Collection is unknown. Start app with coll--[collection name] parameter")
    }

    private checkIfFeedContainsMentionedCollection(feed: any, collection: string) {
        if(!(collection in feed)) throw new Error("Feed doesn't mention about collection. Collection argument --coll must be consent with collection property name within a file");
    }

    private async readFeed(): Promise<any> {
        if(args.feed) {
            if(!existsSync(args.feed)) throw new Error("Feed is not available. Provided feed file is not available");
            
            const _feed = readFileSync(args.feed);
            try {
                const _feedObj = JSON.parse(_feed.toString());
                return _feedObj;
            } catch(ex) {
                throw new Error("Feed file is empty!");
            }
        }
        return StdinJsonReader.tryRead();
    }
}

class IdRandomizerFactory {
    static randomizer(type: string) {
        if(type === 'numeric') return new NumericIdRandomizer();
        return new NumericIdRandomizer();
    }

    static default() {
        return new NumericIdRandomizer();
    }
}

interface IdRandomizer<R> {
    randomize(excluded: R[]): R;
    randomize(excluded: R[], qty: number): R[];
}

class NumericIdRandomizer implements IdRandomizer<number> {
    randomize(excluded: number[]): number;
    randomize(excluded: number[], qty: number): number[];
    randomize(excluded: number[], qty?: unknown): number | number[] {

        interface KeyIdexedObj {
            [key: number]: number; 
        }

        if(!excluded || excluded.length == 0) {
            if(!qty || qty == 0) return Math.floor(Math.random() * 100);

            const uniqueNumbers: KeyIdexedObj = {};

            let uniques = 0;
            let lastUnique = 0;
            while(uniques < qty) {
                let unique = Math.floor(Math.random() * 1000 + lastUnique);
                
                if(uniqueNumbers[unique]) continue;
                
                uniqueNumbers[lastUnique = unique] = 1;
                uniques++;
            }

            return Object.keys(uniqueNumbers).map(key => parseInt(key));
        }

        else {
            const excludedCopy = Array.from(excluded);
            excludedCopy.sort((first, second) => first > second ? 1 : first < second ? -1 : 0);
                
            const excludedNumbers: KeyIdexedObj = {};
            excluded.forEach(ex => excludedCopy[ex] = 1);
            
            if(!qty || qty == 0 || qty == 1) {
                let unique = 0;
                do {
                    unique = Math.floor(Math.random() * 1000) + excludedCopy[excludedCopy.length - 1];   
                } while( excludedNumbers[unique] )

                return unique;
            }
            else {
                
                const uniqueNumbers: KeyIdexedObj = {};

                let uniques = 0;
                while(uniques < qty) {
                    let unique = Math.floor(Math.random() * 1000 + excludedCopy[excludedCopy.length - 1]);
                    
                    if(uniqueNumbers[unique] || excludedNumbers[unique]) continue;
                    
                    uniqueNumbers[unique] = 1;
                    uniques++;
                }
                return Object.keys(uniqueNumbers).map(key => parseInt(key));
            }
        }
    }
}


export { MongoCollectionHost }