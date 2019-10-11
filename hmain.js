const readline = require('readline');
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');

class Earl {
    constructor(ifname, binSize) {
        this.binSize = binSize; 
        this.go(ifname);
    }

    async go(ifname) {
        this.workers = this.makeWorkers();
        this.urls = await this.readURLs(ifname);
        console.log(this.urls);
        this.shuffle(this.urls);
        this.assignWorkers();
        console.log("workers assigned");
    }

    makeWorkers() {
        let workers = [];
        for(let i = 0; i < os.cpus().length; i++) {
            let worker = new Worker("./h.js", {});
            workers.push(worker);
        }
        return workers;
    }

    async readURLs(ifname) {
        const readInterface = readline.createInterface({
            input: fs.createReadStream(ifname),
        });
        
        let urls = [];
    
        let p = new Promise((resolve, reject) => {
            readInterface.on('line', function(line) {
                let url = line.trim();
                //console.log(url);
                urls.push(url);
            });

            readInterface.on('close', () => {
                console.log("done");
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
        console.log(this.urls);
        for(let i = 0; i < this.binSize && i < this.urls.length; i += this.workers.length) {
            for(let j = 0; j < this.workers.length; j++) {
                console.log("ASSIGNING " + this.urls[i + j] + " to " + j);
                this.workers[j].postMessage(this.urls[i + j]);
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

let e = new Earl("small.tsv", 1000);