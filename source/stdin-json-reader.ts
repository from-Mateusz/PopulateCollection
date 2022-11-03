import * as readline from "readline";

export default class StdinJsonReader {
    static async tryRead(): Promise<any> {
        const reader = readline.createInterface(process.stdin);

        const lines = [];
        for await (const line of reader) {
            lines.push(line);
        }


        reader.on("close", () => {
            if(lines.length == 0) throw new Error("Feed file is empty!");
        });

        const json = JSON.parse(lines.join(""));
        return json;
    }
}