const readline = require('readline');
const fs = require('fs');
const sqlite3 = require('sqlite3');

function main() {
    let args = process.argv.slice(2);
    let csvFilename = args[0];
    let dbFilename = args[1];
    createDatabase(csvFilename, dbFilename);
}

async function createDatabase(inputFilename, dbFilename) {
    /*let db = new sqlite3.Database(dbFilename);
    db.run('CREATE TABLE `urls` (`og` TEXT,`can` TEXT, `error` INTEGER, `complete` INTEGER);', (err) => {
        if(err) {
            console.log("Could not create database");
            console.log(err);
        }
        else {
            let lineReader = readline.createInterface({
                input: fs.createReadStream(inputFilename)
            });
        
            lineReader.on('line', (line) => {
                //console.log(line);
                let url = line.trim();
                db.run('INSERT INTO urls(og) VALUES(?)', [url], (err) => {
                    if(err) {
                        console.log("error inserting " + url);
                    }
                    else {
                        console.log("Successfully insterted url " + url);
                    }
                });
            });
        }
    });*/

    //let db = new DB(dbFilename);
    let csv = new CSV(inputFilename);
    
    let i = 0;
    do {
        var nextLine = await csv.readline();
        if(i % 100 === 0) {
            console.log("Hi");
        }
        //console.log(i + ": " + nextLine);
        i++;
    } while(nextLine);
}

class CSV {
    constructor(filename) {
        this.lineReader = readline.createInterface({
            input: fs.createReadStream(filename)
        }); 
    }

    async readline() {
        return new Promise((resolve) => {
            this.lineReader.on('line', (line) => {
                resolve(line.trim());
            });
        });
    }
}

class DB {
    constructor(dbFilename) {
        this.db = new sqlite3.Database(dbFilename);
    }

    async run(sql, params) {
        return new Promise((resolve, reject) => {
            db.run(sql, params, (err) => {
                if(err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }

    close() {
        this.db.close();
    }
}

main();