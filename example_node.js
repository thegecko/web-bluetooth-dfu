var dfu = require('./index').dfu;
var hex2bin = require('./index').hex2bin;
var crc16 = require('./index').crc16;
var fs = require('fs');

var log = console.log;
dfu.addLogger(log);

var fileMask = "";
var fileName = null;

var deviceType = process.argv[2];
if (!deviceType) {
    deviceType = "nrf51";
    log("no device-type specified, defaulting to " + deviceType);
}

switch(deviceType) {
    case "nrf51":
        fileMask = "firmware/nrf51_app_{0}.hex";
        break;
    case "nrf52":
        fileMask = "firmware/nrf52_app.hex";
        break;
    default:
        log("unknown device-type: " + deviceType);
        process.exit();
}

dfu.findDevice({ services: [0x180D] })
.then(device => {
    fileName = fileMask.replace("{0}", device.name === "Hi_Rob" ? "bye" : "hi");
	log("found device: " + device.name);
    log("using file name: " + fileName);

	return dfu.writeMode(device);
})
.then(() => dfu.findDevice({ name: "DfuTarg" }))
.then(device => {
    var file = fs.readFileSync(fileName);
    var hex = file.toString();
    var buffer = hex2bin(hex);
    log("file length: " + buffer.byteLength);
    var crc = crc16(buffer);

    return dfu.provision(device, buffer, crc);
})
.then(() => process.exit())
.catch(error => {
    log(error);
    process.exit();
});