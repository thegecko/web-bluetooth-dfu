/*
* Web Bluetooth DFU
* Copyright (c) 2018 Rob Moran
*
* The MIT License (MIT)
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

var fs = require("fs");
var http = require("http");
var https = require("https");
var readline = require("readline");
var crc = require("crc-32");
var progress = require("progress");
var webbluetooth = require("webbluetooth");
var Package = require("./package");
var SecureDfu = require("../");

process.stdin.setEncoding("utf8");

// Determine package URL or file path
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
        rl.write("firmware/ble_app_buttonless_dfu_s132.zip");
    });
}

// Use a custom Bluetooth instance to control device selection
function findDevice() {
    var bluetoothDevices = [];

    process.stdin.on("readable", () => {
        var input = process.stdin.read();
        if (input === "\u0003") {
            process.exit();
        } else {
            var index = parseInt(input);
            if (index && index <= bluetoothDevices.length) {
                process.stdin.setRawMode(false);
                bluetoothDevices[index - 1].select();
                bluetoothDevices = [];
            }
        }
    });

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

    var bluetooth = new webbluetooth.Bluetooth({
        deviceFound: handleDeviceFound
    });

    return bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SecureDfu.SERVICE_UUID]
    });
}

// Load a file, returning a buffer
function loadFile(fileName) {
    var file = fs.readFileSync(fileName);
    return new Uint8Array(file).buffer;
}

// Download a file, returning a buffer
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

// Update device using image containing init packet and data
function updateFirmware(dfu, device, image) {
    console.log(`Using firmware: ${image.imageFile}`);

    var progressBar = new progress(`Updating ${image.type} [:bar] :percent :etas`, {
        complete: "=",
        incomplete: " ",
        width: 20,
        total: image.imageData.byteLength
    });

    dfu.addEventListener(SecureDfu.EVENT_PROGRESS, event => {
        if (event.object === "firmware") {
            progressBar.update(event.currentBytes / event.totalBytes);
        }
    });

    return dfu.update(device, image.initData, image.imageData);
}

function update() {
    var package = null;
    var device = null;
    var dfu = null;

    getFileName()
    .then(fileName => {
        if (!fileName) throw new Error("No file name specified");
        if (fileName.indexOf("http") === 0) return downloadFile(fileName);
        return loadFile(fileName);
    })
    .then(file => {
        package = new Package(file);
        return package.load();
    })
    .then(() => {
        console.log("Scanning for DFU devices...");
        return findDevice();
    })
    .then(selectedDevice => {
        console.log(`${selectedDevice.name} selected, connecting...`);

        // Use default bluetooth instance
        dfu = new SecureDfu(crc.buf, webbluetooth.bluetooth);
        return dfu.setDfuMode(selectedDevice);
    })
    .then(selectedDevice => {
        if (selectedDevice) return selectedDevice;

        console.log("DFU mode set, reconnecting...");
        return dfu.requestDevice();
    })
    .then(selectedDevice => {
        device = selectedDevice;
        return package.getBaseImage();
    })
    .then(image => {
        if (image) return updateFirmware(dfu, device, image);
    })
    .then(() => package.getAppImage())
    .then(image => {
        if (image) return updateFirmware(dfu, device, image);
    })
    .then(() => {
        console.log("Update complete");
        process.exit();
    })
    .catch(error => {
        console.log(error.message || error);
        process.exit();
    });
}

update();
