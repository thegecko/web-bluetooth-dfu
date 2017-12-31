var fs = require("fs");
var http = require("http");
var https = require("https");
var readline = require("readline");
var crc = require("crc-32");
var JSZip = require("jszip");
var progress = require("progress");
var bluetooth = require("bleat").webbluetooth;
var secureDfu = require("../index").secure;

var bluetoothDevices = [];
var progressBar = null;

function logError(error) {
    console.log(error.message || error);
    process.exit();
}

function getFileName() {
    return new Promise((resolve) => {
        if (process.argv[2]) {
            return resolve(process.argv[2]);
        }

        var rl = readline.createInterface(process.stdin, process.stdout);
        rl.question("Enter a URL or file path for the firmware package: ", answer => {
            rl.close();
            resolve(answer);
        });
        rl.write("firmware/dfu_test_app_hrm_s132.zip");
    });
}

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        console.log("Downloading file...");
        var scheme = (url.indexOf("https") === 0) ? https : http;

        scheme.get(url, response => {
            var data = [];
            response.on("data", chunk => {
                data.push(chunk);
            });
            response.on("end", () => {
                if (response.statusCode !== 200) return reject(response.statusMessage);

                var download = Buffer.concat(data);
                resolve(new Uint8Array(download).buffer);
            });
        })
        .on("error", error => {
            reject(error);
        });
    });
}

function loadFile(fileName) {
    return new Promise((resolve) => {
        var file = fs.readFileSync(fileName);
        resolve(new Uint8Array(file).buffer);
    });
}

function handleDeviceFound(bluetoothDevice, selectFn) {
    var discovered = bluetoothDevices.some(device => {
        return (device.id === bluetoothDevice.id);
    });
    if (discovered) return;

    if (bluetoothDevices.length === 0) {
        process.stdin.setRawMode(true);
        console.log("Select a device to update:");
    }

    bluetoothDevices.push({ id: bluetoothDevice.id, select: selectFn });
    console.log(`${bluetoothDevices.length}: ${bluetoothDevice.name}`);
}

function updateFirmware(dfu, package, manifest, device, type) {
    var init = null;

    return package.file(manifest.dat_file).async("arraybuffer")
    .then(data => {
        init = data;
        return package.file(manifest.bin_file).async("arraybuffer");
    })
    .then(data => {
        console.log(`Using firmware: ${manifest.bin_file}`);
        progressBar = new progress(`Updating ${type} [:bar] :percent :etas`, {
            complete: "=",
            incomplete: " ",
            width: 20,
            total: data.byteLength
        });
        return dfu.update(device, init, data);
    });
}

function update() {
    var device = null;
    var dfu = null;
    var package = null;
    var manifest = null;

    getFileName()
    .then(fileName => {
        if (!fileName) throw new Error("No file name specified");
        if (fileName.indexOf("http") === 0) return downloadFile(fileName);
        return loadFile(fileName);
    })
    .then(file => {
        return JSZip.loadAsync(file);
    })
    .then(zipFile => {
        try {
            package = zipFile;
            return zipFile.file("manifest.json").async("string");
        } catch(e) {
            throw new Error("Unable to find manifest, is this a proper DFU package?");
        }
    })
    .then(content => {
        manifest = JSON.parse(content).manifest;
        dfu = new secureDfu(crc.buf);
        dfu.addEventListener("progress", event => {
            if (progressBar && event.object === "firmware") {
                progressBar.update(event.currentBytes / event.totalBytes);
            }
        });

        console.log("Scanning for DFU devices...");
        return bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [secureDfu.SERVICE_UUID],
            deviceFound: handleDeviceFound
        });
    })
    .then(device => {
        console.log(`${device.name} selected, connecting...`);
        return dfu.setDfuMode(device);
    })
    .then(device => {
        if (device) return device;

        console.log("DFU mode set");
        return bluetooth.requestDevice({
            filters: [{ services: [secureDfu.SERVICE_UUID] }],
            deviceFound: () => {
                // Select first device found with correct service
                return true;
            }
        });
    })
    .then(selectedDevice => {
        device = selectedDevice;

        for (var type of ["softdevice", "bootloader", "softdevice_bootloader"]) {
            if (manifest[type]) {
                return updateFirmware(dfu, package, manifest[type], device, type);
            }
        }
    })
    .then(() => {
        if (manifest.application) {
            return updateFirmware(dfu, package, manifest.application, device, "application");
        }
    })
    .then(() => {
        console.log("Update complete!");
        process.exit();
    })
    .catch(logError);
}

process.stdin.setEncoding('utf8');
process.stdin.on('readable', () => {
    var input = process.stdin.read();
    if (input === '\u0003') {
        process.exit();
    } else {
        var index = parseInt(input);
        if (index && index <= bluetoothDevices.length) {
            process.stdin.setRawMode(false);
            bluetoothDevices[index - 1].select();
        }
    }
});

update();
