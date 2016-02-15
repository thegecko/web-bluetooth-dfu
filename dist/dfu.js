/* @license
 *
 * Device firmware update with Web Bluetooth
 * Version: 0.0.1
 *
 * Protocol from:
 * http://developer.nordicsemi.com/nRF51_SDK/nRF51_SDK_v8.x.x/doc/8.1.0/s110/html/a00103.html
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 Rob Moran
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

// https://github.com/umdjs/umd
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['es6-promise', 'bleat'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS
        module.exports = factory(Promise, require('bleat'));
    } else {
        // Browser globals with support for web workers (root is window)
        root.dfu = factory(Promise, root.navigator.bluetooth);
    }
}(this, function(Promise, bluetooth) {
    "use strict";

    var packetSize = 20;
    var notifySteps = 40;

    var serviceUUID = "00001530-1212-efde-1523-785feabcd123";
    var controlUUID = "00001531-1212-efde-1523-785feabcd123";
    var packetUUID = "00001532-1212-efde-1523-785feabcd123";
    var versionUUID = "00001534-1212-efde-1523-785feabcd123";

    var ImageType = {
        None: 0,
        SoftDevice: 1,
        Bootloader: 2,
        SoftDevice_Bootloader: 3,
        Application: 4
    };

    var littleEndian = (function() {
        var buffer = new ArrayBuffer(2);
        new DataView(buffer).setInt16(0, 256, true);
        return new Int16Array(buffer)[0] === 256;
    })();

    var loggers = [];
    function addLogger(loggerFn) {
        if (typeof loggerFn === "function") {
            loggers.push(loggerFn);
        }
    }
    function log(message) {
        loggers.forEach(logger => {
            logger(message);
        });
    }

    function findDevice(filters) {
        return bluetooth.requestDevice({
            filters: [ filters ],
            optionalServices: [serviceUUID]
        });
    }

    function writeMode(device) {
        return new Promise(function(resolve, reject) {
/*
            // Disconnect event currently not implemented
            device.addEventListener("gattserverdisconnected", () => {
                log("modeData written");
                resolve();                
            });
*/
            connect(device)
            .then(chars => {
                log("writing modeData...");
                chars.controlChar.writeValue(new Uint8Array([1]));

                // Hack to gracefully disconnect without disconnect event
                setTimeout(() => {
                    chars.server.disconnect();
                    setTimeout(() => {
                        log("modeData written");
                        resolve(device);
                    }, 3000);
                }, 3000);
            })
            .catch(error => {
                error = "writeMode error: " + error;
                log(error);
                reject(error);
            });
        });
    }

    function provision(device, arrayBuffer, imageType) {
        return new Promise(function(resolve, reject) {
            imageType = imageType || ImageType.Application;

            connect(device)
            .then(chars => {
                if (chars.versionChar) {
                    return chars.versionChar.readValue()
                    .then(data => {
                        var view = new DataView(data);
                        var major = view.getUint8(0);
                        var minor = view.getUint8(1);
                        return transfer(chars, arrayBuffer, imageType, major, minor);
                    });
                } else {
                    // Default to version 6.0
                    return transfer(chars, arrayBuffer, imageType, 6, 0);
                }
            })
            .then(() => {
                resolve();
            })
            .catch(error => {
                log(error);
                reject(error);
            });
        });
    }

    function connect(device) {
        return new Promise(function(resolve, reject) {
            var server = null;
            var service = null;
            var controlChar = null;
            var packetChar = null;
            var versionChar = null;

            function complete() {
                resolve({
                    server: server,
                    controlChar: controlChar,
                    packetChar: packetChar,
                    versionChar: versionChar
                });
            }

            device.connectGATT()
            .then(gattServer => {
                // Connected
                server = gattServer;
                log("connected to device");
                return server.getPrimaryService(serviceUUID);
            })
            .then(primaryService => {
                log("found DFU service");
                service = primaryService;
                return service.getCharacteristic(controlUUID);
            })
            .then(characteristic => {
                log("found control characteristic");
                controlChar = characteristic;
                return service.getCharacteristic(packetUUID);
            })
            .then(characteristic => {
                log("found packet characteristic");
                packetChar = characteristic;
                service.getCharacteristic(versionUUID)
                .then(characteristic => {
                    log("found version characteristic");
                    versionChar = characteristic;
                    complete();
                })
                .catch(error => {
                    complete();
                });
            })
            .catch(error => {
                error = "connect error: " + error;
                log(error);
                reject(error);
            });
        });
    }

    var interval;
    var offset;
    function transfer(chars, arrayBuffer, imageType, majorVersion, minorVersion) {
        return new Promise(function(resolve, reject) {
            var controlChar = chars.controlChar;
            var packetChar = chars.packetChar;
            log('using dfu version ' + majorVersion + "." + minorVersion);

            // Set up receipts
            interval = Math.floor(arrayBuffer.byteLength / (packetSize * notifySteps));
            offset = 0;

            if (!controlChar.properties.notify) {
                var error = "controlChar missing notify property";
                log(error);
                return reject(error);
            }

            log("enabling notifications");
            controlChar.startNotifications()
            .then(() => {
                controlChar.addEventListener('characteristicvaluechanged', handleControl);
                log("sending imagetype: " + imageType);
                return controlChar.writeValue(new Uint8Array([1, imageType]));
            })
            .then(() => {
                log("sent start");

                var softLength = (imageType === ImageType.SoftDevice) ? arrayBuffer.byteLength : 0;
                var bootLength = (imageType === ImageType.Bootloader) ? arrayBuffer.byteLength : 0;
                var appLength = (imageType === ImageType.Application) ? arrayBuffer.byteLength : 0;

                var buffer = new ArrayBuffer(12);
                var view = new DataView(buffer);
                view.setUint32(0, softLength, littleEndian);
                view.setUint32(4, bootLength, littleEndian);
                view.setUint32(8, appLength, littleEndian);

                // Set firmware length
                return packetChar.writeValue(view);
            })
            .then(() => {
                log("sent buffer size: " + arrayBuffer.byteLength);
            })
            .catch(error => {
                error = "start error: " + error;
                log(error);
                reject(error);
            });

            function handleControl(event) {
                var data = event.target.value;
                var view = new DataView(data);
                var opCode = view.getUint8(0);

                if (opCode === 16) { // response
                    var resp_code = view.getUint8(2);
                    if (resp_code !== 1) {
                        var error = "error from control: " + resp_code;
                        log(error);
                        return reject(error);
                    }

                    var req_opcode = view.getUint8(1);
                    if (req_opcode === 1 && majorVersion > 6) {
                        log('write null init packet');

                        controlChar.writeValue(new Uint8Array([2,0]))
                        .then(() => {
                            return packetChar.writeValue(new Uint8Array([0]));
                        })
                        .then(() => {
                            return controlChar.writeValue(new Uint8Array([2,1]));
                        })
                        .catch(error => {
                            error = "error writing init: " + error;
                            log(error);
                            reject(error);
                        });

                    } else if (req_opcode === 1 || req_opcode === 2) {
                        log('complete, send packet count');

                        var buffer = new ArrayBuffer(3);
                        view = new DataView(buffer);
                        view.setUint8(0, 8);
                        view.setUint16(1, interval, littleEndian);

                        controlChar.writeValue(view)
                        .then(() => {
                            log("sent packet count: " + interval);
                            return controlChar.writeValue(new Uint8Array([3]));
                        })
                        .then(() => {
                            log("sent receive");
                            return writePacket(packetChar, arrayBuffer, 0);
                        })
                        .catch(error => {
                            error = "error sending packet count: " + error;
                            log(error);
                            reject(error);
                        });

                    } else if (req_opcode === 3) {
                        log('complete, check length');

                        controlChar.writeValue(new Uint8Array([7]))
                        .catch(error => {
                            error = "error checking length: " + error;
                            log(error);
                            reject(error);
                        });

                    } else if (req_opcode === 7) {
                        var byteCount = view.getUint32(3, littleEndian);
                        log('length: ' + byteCount);
                        log('complete, validate...');

                        controlChar.writeValue(new Uint8Array([4]))
                        .catch(error => {
                            error = "error validating: " + error;
                            log(error);
                            reject(error);
                        });

                    } else if (req_opcode === 4) {
                        log('complete, reset...');
/*
                        // Disconnect event currently not implemented
                        controlChar.service.device.addEventListener("gattserverdisconnected", () => {
                            resolve();
                        });
*/
                        controlChar.writeValue(new Uint8Array([5]))
                        .then(() => {
                            // Hack to gracefully disconnect without disconnect event
                            setTimeout(() => {
                                chars.server.disconnect();
                                resolve();
                            }, 3000);
                        })
                        .catch(error => {
                            error = "error resetting: " + error;
                            log(error);
                            reject(error);
                        });
                    }

                } else if (opCode === 17) {
                    var bytes = view.getUint32(1, littleEndian);
                    log('transferred: ' + bytes);
                    writePacket(packetChar, arrayBuffer, 0);
                }
            }
        });
    }

    function writePacket(packetChar, arrayBuffer, count) {
        var size = (offset + packetSize > arrayBuffer.byteLength) ? arrayBuffer.byteLength - offset : packetSize;
        var packet = arrayBuffer.slice(offset, offset + size);
        var view = new Uint8Array(packet);

        packetChar.writeValue(view)
        .then(() => {
            count ++;
            offset += packetSize;
            if (count < interval && offset < arrayBuffer.byteLength) {
                writePacket(packetChar, arrayBuffer, count);
            }
        })
        .catch(error => {
            error = "writePacket error: " + error;
            log(error);
        });
    }

    return {
        addLogger: addLogger,
        ImageType: ImageType,
        findDevice: findDevice,
        writeMode: writeMode,
        provision: provision
    };
}));