import { MongoCollectionHost } from "./mongo";
import * as readline from "readline";
import { stdin as is, stdout as os } from "process";

const doFeed = async () => {
    const collectionHost = new MongoCollectionHost();
    try {
        await collectionHost.feed();
    } catch(error) {
        console.log("Fatal error: ", error);
    }
}

doFeed();