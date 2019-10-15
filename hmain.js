const readline = require('readline');
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');

class Earl {
    constructor(ifname, binSize) {
        this.binSize = binSize; 
        this.accessLogs = {};
        this.go(ifname);
    }

    async go(ifname) {
        this.workers = this.makeWorkers();
        this.urls = await this.readURLs(ifname);
        //console.log(this.urls);
        this.shuffle(this.urls);
        this.assignWorkers();
        //console.log("workers assigned");
    }

    makeWorkers() {
        let workers = [];
        //os.cpus().length

        for(let i = 0; i < 3; i++) {
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
        }
    }

    async readURLs(ifname) {
        console.log("READING URLS");
        const readInterface = readline.createInterface({
            input: fs.createReadStream(ifname),
        });
        
        let urls = [];
    
        let p = new Promise((resolve, reject) => {
            readInterface.on('line', function(line) {
                let url = line.trim();
                ////console.log(url);
                urls.push(url);
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
        return urls;
    }

    assignWorkers() {
        console.log("ASSINGING WORKERS");
        //console.log(this.urls);
        let binOffset = this.binSize * this.currentBin;
        for(let i = 0; i < this.binSize && i < this.urls.length; i += this.workers.length) {
            for(let j = 0; j < this.workers.length; j++) {
                //console.log("ASSIGNING " + this.urls[i + j] + " to " + j);
                this.workers[j].postMessage({"url": this.urls[binOffset + i + j]});
            }
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

let e = new Earl("urls.tsv", 1000);