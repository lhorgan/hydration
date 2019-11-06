const child_process = require('child_process');

function runner() {
    var hydrater = child_process.spawn("node", ["--max-old-space-size=12000", "hmain.js"]);

    /*hydrater.stdout.on('data', function(data) {
        console.log(data.toString().trim()); 
    });*/

    setTimeout(() => {
        console.log("KILLING");
        hydrater.stdin.pause();
        hydrater.kill();
        runner();
    }, 15*60*1000);
}

runner();