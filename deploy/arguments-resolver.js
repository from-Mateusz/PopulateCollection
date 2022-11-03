"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ArgumentsResolver {
    static resolve() {
        const args = process.argv;
        if (args.length < 2)
            return {};
        let jsonLike = "{";
        for (let ai = 2; ai < args.length; ai++) {
            const jsonProperty = args[ai].split("--");
            jsonLike += `"${jsonProperty[0]}": "${jsonProperty[1]}"${args.length != ai + 1 ? "," : ""}`;
        }
        jsonLike += "}";
        return JSON.parse(jsonLike);
    }
}
exports.default = ArgumentsResolver;
