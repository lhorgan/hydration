const readline = require('readline');
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');

class Earl {
    constructor(ifname, results_name, binSize) {
        this.urlIndex = 0;
        this.binSize = binSize; 
        this.accessLogs = {};
        this.assignmentCounts = [];
        this.urlsToWrite = [];
        this.processedURLs = new Set([]);
        this.results_name = results_name;
        this.go(ifname);
    }

    async go(ifname) {
        this.workers = this.makeWorkers();
        await this.readProcessedURLs(this.results_name);
        this.urls = await this.readURLs(ifname);
        //console.log(this.urls);
        this.shuffle(this.urls);
        this.initialAssignWorkers();
        //console.log("workers assigned");
    }

    makeWorkers() {
        let workers = [];
        //os.cpus().length

        console.log("Utilizing " + os.cpus().length + " CPUs to make workers...");

        for(let i = 0; i < os.cpus().length; i++) {
            let worker = new Worker("./h.js", {});
            worker.on("message", (message) => {
                //console.log("we got a message in the main thread");
                this.handleWorkerMessage(message, worker);
            });
            workers.push(worker);
        }
        return workers;
    }

    handleWorkerMessage(message, worker) {
        //console.log("HEY, MESSAGE REQUEST RECEIVED");
        //console.log(JSON.stringify(message));
        if(message["kind"] === "lastAccessed") {
            let domain = message["domain"];
            let time = 0;
            if(domain in this.accessLogs) {
                time = this.accessLogs[domain];
            }
            worker.postMessage({kind: "lastAccessed", mid: message["mid"], time: time});
        }
        else if(message["kind"] === "updateAccessLogs") {
            let domain = message["domain"];
            let time = message["time"];
            this.accessLogs[domain] = time;
        }
        else if(message["kind"] === "writeURL") {
            console.log(message.url + " --< " + message.origURL);
            this.urlsToWrite.push(message);
            if(this.urlsToWrite.length >= 50) {
                this.writeURLs();
            }

            if(this.urlIndex < this.urls.length) {
                worker.postMessage({"url": this.urls[this.urlIndex], "queue": false});
                this.urlIndex++;
            }
            else {
                console.log("we are done");
                this.writeURLs();
            }
        }
    }

    writeURLs() {
        //console.log("Writing a batch of URLs");
        let urlsCopy = JSON.parse(JSON.stringify(this.urlsToWrite)); // live with it
        this.urlsToWrite.length = 0;
        let urlStr = "";
        for(let i = 0; i < urlsCopy.length; i++) {
            urlStr += urlsCopy[i].url + "\t" + urlsCopy[i].origURL + "\t" + urlsCopy[i].urlWithParams + "\t" + urlsCopy[i].year + "\t" + urlsCopy[i].error;
            if(urlsCopy[i].error) {
                //console.log("There has been an error, we are writing "  + urlsCopy[i].errorMessage);
                urlStr += "\t" + '"' + urlsCopy[i].errorMessage + '"';
            }
            urlStr += "\r\n";
        }
        /*fs.appendFile(this.results_name, urlStr, (err) => {
            if(err) {
                throw(err);
            }
        });*/

        var stream = fs.createWriteStream(this.results_name, {flags:'a'});
        stream.write(urlStr);
        stream.end();
    }

    async readURLs(ifname) {
        console.log("READING URLS");
        const readInterface = readline.createInterface({
            input: fs.createReadStream(ifname),
        });
        
        let urls = [];
        
        let duplicates = 0;
        let p = new Promise((resolve, reject) => {
            readInterface.on('line', (line) => {
                let [url, year] = line.trim().split("\t");
                if(url[0] != "#" && !this.processedURLs.has(url)) {
                    ////console.log(url);
                    urls.push([url, year]);
                }
                else if(this.processedURLs.has(url)) {
                    duplicates++;
                }
            });

            readInterface.on('close', () => {
                //console.log("done");
                resolve();
            });
            
            readInterface.on('error', (err) => {
                reject(err);
            });
        });
        await p;
        console.log("Found " + duplicates + " duplicate URLs");
        this.processedURLs = null;
        return urls;
    }

    async readProcessedURLs(ifname) {
        console.log("READING *OLD* URLs");
        const readInterface = readline.createInterface({
            input: fs.createReadStream(ifname),
        });
        
        let p = new Promise((resolve, reject) => {
            readInterface.on('line', (line) => {
                let url = line.split("\t")[1];
                //console.log("READ URL " + url);
                this.processedURLs.add(url);
            });

            readInterface.on('close', () => {
                //console.log("done");
                resolve();
            });
            
            readInterface.on('error', (err) => {
                reject(err);
            });
        });
        await p;
    }

    initialAssignWorkers() {
        console.log("ASSINGING WORKERS");
        //console.log(this.urls);
        let assignedURLsCount = 0;
        for(let i = 0; i < this.binSize; i++) {
            for(let j = 0; j < this.workers.length; j++) {
                if(assignedURLsCount < this.urls.length) {
                    this.workers[j].postMessage({"url": this.urls[this.urlIndex][0], "queue": true, "year": this.urls[this.urlIndex][1]});
                    //this.urlIndex++;
                    assignedURLsCount++;
                }
                else {
                    break;
                }
            }
        }
        console.log("URL INDEX IS " + this.urlIndex);

        for(let i = 0; i < this.workers.length; i++) {
            this.workers[i].postMessage({"go": true});
        }
    }

    // taken from https://javascript.info/task/shuffle, beacuse laziness
    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

let e = new Earl("todos/0.tsv", "results/0.tsv", 50);
