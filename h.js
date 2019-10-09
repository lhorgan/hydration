const micro = require("microtime");
const request = require("request");
const cheerio = require("cheerio");
const URL = require('url');
const difflib = require('difflib');

const TIME_TO_WAIT = 1000000;
const TIMEOUT = 300;

class UrlProcessor {
    constructor() {
        this.accessLog = {};
    }

    // url --> original url, new url
    async followRedirects(entry) {
        let [resp, body] = await this.hitURL(entry.url, {
                                        method: "HEAD",
                                        followAllRedirects: false,
                                        followRedirect: false,
                                        timeout: TIMEOUT
                                    });
        console.log("HERE IS THE NEW URL");
        let newURL = resp.request.uri.href;
        if(newURL === entry.url) {
            return entry;
        }
        else {
            entry.url = newURL;
            return this.followRedirects(entry);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async process(entry) {
        let entry = await this.followRedirects(entry);
        entry["text"] = this.getContent(entry.url);
        entry["tree"] = cheerio.load(entry["text"]);
        let entry = await this.stripParams(entry);
    }

    async stripParams(entry) {
        console.log("HERE IS OUR ENTRY");
        console.log(entry.url);
        console.log(entry.params);
        if(Object.keys(entry.params).length === 0) {
            return entry;
        }

        let parsedURL = URL.parse(entry.url, {parseQueryString: true});
        let params = entry["params"];
        let newParams = {};
        for(let i = 1; i < Object.keys(params).length; i++) {
            let paramName = Object.keys(params)[i];
            parsedURL.query[paramName] = params[paramName];
            newParams[paramName] = params[paramName];
        }
        let newURL = URL.format(parsedURL);
        let newText = await this.getContent(newURL);
        console.log("HERE IS THE URL WE ARE HITTING");
        console.log(newURL);
        
        let a = {"text": entry.text, "tree": entry.tree};
        let b = {"text": newText, "tree": cheerio.load(newText)};

        // we removed one param - is the content the same?
        if(!this.isContentDifferent(a, b)) { // the content IS the same with the one removed param
            console.log("REMOVING PARAM " + Object.keys(params)[0] + " did not result in a change");
            // so we just drop that param
            entry["params"] = newParams;
        }
        else {
            console.log("REMOVING PARAM" + Object.keys(params)[0] + " CHANGED THE PAGE!!!");
            entry["params"] = newParams;
            parsedURL = URL.parse(entry.url, {parseQueryString: true});
            let removedParamName = Object.keys()[0];
            parsedURL.query[removedParamName] = params[removedParamName];
            entry["url"] = URL.format(parsedURL);
        }
        
        console.log("\n");

        return this.stripParams(entry);
    }

    // url --> time when last accessed
    async lastAccessed(url) {
        // console.log("CHECKING ACCESS LOG FOR " + url);
        // return new Promise((resolve, reject) => {
        //     if(url in this.accessLog) {
        //         resolve(this.accessLog[url]);
        //     }
        //     else {
        //         resolve(0);
        //     }
        // });
        return 0;
    }

    updateAccessLogs(url) {
        // tbd
    }

    async hitURL(url, options) {
        let timeOfLastAccess = await this.lastAccessed(url);
        if(micro.now() - timeOfLastAccess > TIME_TO_WAIT) {
            return new Promise((resolve, reject) => {
                this.updateAccessLogs(url);
                request(url, {
                    options,
                }, (err, resp, body) => {
                    if(err) {
                        reject(err);
                    }
                    else {
                        resolve([resp, body]);
                    }
                });
            });
        }
        else {
            console.log("We must wait a bit because " + url + " has been accessed too recently.");
            let timeToDelay = max(TIME_TO_WAIT - (micro.now() - timeOfLastAccess), 0);
            
            await this.delay(timeToDelay);
            return this.hitURL(url, options);
        }
    }

    // url --> text of page at URL
    async getContent(url) {
        let [resp, body] = await this.hitURL(url, {timeout: TIMEOUT});

        return body;
    }

    // page, page --> is the text different? true/false
    isContentDifferent(a, b) {
        let aTitle = a.tree("title").text();
        let bTitle = b.tree("title").text();

        // console.log("B TEXT");
        // console.log(b.text);
        // console.log("A TEXT");
        // console.log(a.text);

        let s = new difflib.SequenceMatcher(null, a.text, b.text);
        let diff = s.quickRatio();

        return ((diff < 0.98 && aTitle != bTitle) || diff < 0.05);
    }

    async test() {
        //urlproc.followRedirects({"url": "http://bit.ly/31UAFMx"});
        /*console.log("HITTING");
        let text = await urlproc.getContent("http://bit.ly/31UAFMx");
        console.log("parsing");
        let $ = cheerio.load(text);
        console.log($("title").text());*/
        let entry = {"url": "https://www.amazon.com/Hello-World-Boxed-Jill-McDonald/dp/0525581324/ref=sr_1_1?keywords=hello+world&qid=1570659748&sr=8-1"};
        let parsed = URL.parse(entry.url, {parseQueryString: true});
        entry["params"] = parsed.query;
        entry["url"] = entry.url.split("?")[0];
        entry["text"] = await this.getContent(entry.url);
        entry["tree"] = await cheerio.load(entry["text"]);
        await this.stripParams(entry);
    }
}

urlproc = new UrlProcessor();
urlproc.test();