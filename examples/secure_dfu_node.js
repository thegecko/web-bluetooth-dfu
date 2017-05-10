var fs = require('fs');
var bluetooth = require("bleat").webbluetooth;
var crc = require("crc-32");
var progress = require('progress');
var secureDfu = require("../index").secure;
var bluetoothDevices = [];

var dat = fs.readFileSync("test_images_update_nrf52832/dfu_test_app_hrm_s132/nrf52832_xxaa.dat");
var bin = fs.readFileSync("test_images_update_nrf52832/dfu_test_app_hrm_s132/nrf52832_xxaa.bin");

function logError(error) {
    console.log(error);
    process.exit();
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
            selectDevice(index - 1);
        }
    }
});

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}

function selectDevice(index) {
    var bar = null;
    var device = bluetoothDevices[index];
    var dfu = new secureDfu(crc.buf);
    dfu.addEventListener("progress", event => {
        if (bar) bar.update(event.currentBytes / event.totalBytes);
    });

    console.log();

    dfu.connect(device)
    .then(() => {
        process.stdout.write("Transferring init packet...");
        return dfu.transferInit(toArrayBuffer(dat));
    })
    .then(data => {
        console.log("Done");
        var data = toArrayBuffer(bin);
        bar = new progress('Transferring firmware [:bar] :percent :etas', {
            complete: '=',
            incomplete: ' ',
            width: 20,
            total: data.byteLength
        });
        return dfu.transferFirmware(data);
    })
    .then(() => {
        console.log("\nComplete!");
        process.exit();
    })
    .catch(logError);
}

function handleDeviceFound(bluetoothDevice) {
    var discovered = bluetoothDevices.some(device => {
        return (device.id === bluetoothDevice.id);
    });
    if (discovered) return;

    if (bluetoothDevices.length === 0) {
        process.stdin.setRawMode(true);
        console.log("Select a device to update:");
    }

    bluetoothDevices.push(bluetoothDevice);
    console.log(bluetoothDevices.length + ": " + bluetoothDevice.name);
}

console.log("Scanning for DFU devices...");
bluetooth.requestDevice({
    filters: [{ services: [0xFE59] }],
	deviceFound: handleDeviceFound
})
.then(() => {
    if (bluetoothDevices.length === 0) {
        console.log("no devices found");
        process.exit();
    }
})
.catch(logError);
