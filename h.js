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
        let timeOfLastAccess = await this.lastAccessed(entry.url);
        if(micro.now() - timeOfLastAccess > TIME_TO_WAIT) {
            let [resp, body] = await this.hitURL(entry.url, {
                                            method: "HEAD",
                                            followAllRedirects: false,
                                            followRedirect: false,
                                            timeout: TIMEOUT
                                        });
            console.log("HERE IS THE NEW URL");
            let newURL = resp.request.uri.href;
            if(newURL === entry.url) {
                console.log("we are done");
                return "done";
            }
            else {
                entry.url = newURL;
                return this.followRedirects(entry);
            }
        }
        else {
            console.log("we must wait a bit");
            await this.delay();
            return false;
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
        this.accessLog[url] = micro.now();
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

    getTime() {

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