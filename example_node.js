var dfu = require('./index').dfu;
var hex2bin = require('./index').hex2bin;
var fs = require('fs');

var log = console.log;
dfu.addLogger(log);

var fileMask = "firmware/NRF51822_{0}_Rob_OTA.hex";
var fileName = null;

dfu.findDevice({ services: [0x180D] })
.then(device => {
    fileName = fileMask.replace("{0}", device.name === "Hi_Rob" ? "Bye" : "Hi");
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

    return dfu.provision(device, buffer);
})
.then(() => process.exit())
.catch(error => {
    log(error);
    process.exit();
});