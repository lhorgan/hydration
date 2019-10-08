const micro = require("microtime");
const request = require("request");

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

    process(entry) {

    }

    // url --> time when last accessed
    async lastAccessed(url) {
        console.log("CHECKING ACCESS LOG FOR " + url);
        return new Promise((resolve, reject) => {
            if(url in this.accessLog) {
                resolve(this.accessLog[url]);
            }
            else {
                resolve(0);
            }
        });
    }

    async hitURL(url, options) {
        let timeOfLastAccess = await this.lastAccessed(url);
        if(micro.now() - timeOfLastAccess > TIME_TO_WAIT) {
            return new Promise((resolve, reject) => {
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
    getContent(url) {

    }

    // page, page --> is the text different? true/false
    isContentDifferent(a, b, cb) {

    }

    // text --> page tree
    parsePage(text) {

    }
}

urlproc = new UrlProcessor();
urlproc.followRedirects({"url": "http://bit.ly/31UAFMx"});