const readline = require('readline');
const fs = require('fs');
var sizeof = require('object-sizeof');

function main() {
    let args = process.argv.slice(2);
    let csvFilename = args[0];
    read(csvFilename);
}

function read(inputFilename) {
    const readInterface = readline.createInterface({
        input: fs.createReadStream(inputFilename),
    });
    
    let urls = [];

    readInterface.on('line', function(line) {
        let url = line.trim();
        urls.push(url);
    });

    readInterface.on('close', () => {
        console.log("done");
        console.log(sizeof(urls));
    });
}

class Earl {
    constructor() {
        this.workers = this.makeWorkers();
    }

    makeWorkers() {
        let workers = [];
        for(let i = 0; i < os.cpus().length; i++) {
            let worker = new Worker(path, { workerData });
            workers.push(worker);
        }
        return workers;
    }
}

main();