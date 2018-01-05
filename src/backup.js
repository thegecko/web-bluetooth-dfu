/*
* Node Web Bluetooth
* Copyright (c) 2017 Rob Moran
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

// https://github.com/umdjs/umd
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Unsupported
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS
        module.exports = factory(require('webbluetooth').bluetooth);
    } else {
        // Browser globals with support for web workers (root is window)
        root.SecureDfu = factory(root.navigator.bluetooth);
    }
}(this, function(bluetooth) {
    "use strict";

    const SERVICE_UUID = 0xFE59;
    const CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
    const PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";
    const BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";

    const LITTLE_ENDIAN = true;
    const PACKET_SIZE = 20;

    const OPERATIONS = {
        BUTTON_COMMAND:         [0x01],
        CREATE_COMMAND:         [0x01, 0x01],
        CREATE_DATA:            [0x01, 0x02],
        RECEIPT_NOTIFICATIONS:  [0x02],
        CACULATE_CHECKSUM:      [0x03],
        EXECUTE:                [0x04],
        SELECT_COMMAND:         [0x06, 0x01],
        SELECT_DATA:            [0x06, 0x02],
        RESPONSE:               [0x60, 0x20]
    };

    const RESPONSE = {
        0x00: "Invalid code",               // Invalid opcode.
        0x01: "Success",                    // Operation successful.
        0x02: "Opcode not supported",       // Opcode not supported.
        0x03: "Invalid parameter",          // Missing or invalid parameter value.
        0x04: "Insufficient resources",     // Not enough memory for the data object.
        0x05: "Invalid object",             // Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed.
        0x07: "Unsupported type",           // Not a valid object type for a Create request.
        0x08: "Operation not permitted",    // The state of the DFU process does not allow this operation.
        0x0A: "Operation failed",           // Operation failed.
        0x0B: "Extended error"              // Extended error.
    };

    const EXTENDED_ERROR = {
        0x00: "No error",                   // No extended error code has been set. This error indicates an implementation problem.
        0x01: "Invalid error code",         // Invalid error code. This error code should never be used outside of development.
        0x02: "Wrong command format",       // The format of the command was incorrect.
        0x03: "Unknown command",            // The command was successfully parsed, but it is not supported or unknown.
        0x04: "Init command invalid",       // The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type.
        0x05: "Firmware version failure",   // The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version.
        0x06: "Hardware version failure",   // The hardware version of the device does not match the required hardware version for the update.
        0x07: "Softdevice version failure", // The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice.
        0x08: "Signature missing",          // The init packet does not contain a signature.
        0x09: "Wrong hash type",            // The hash type that is specified by the init packet is not supported by the DFU bootloader.
        0x0A: "Hash failed",                // The hash of the firmware image cannot be calculated.
        0x0B: "Wrong signature type",       // The type of the signature is unknown or not supported by the DFU bootloader.
        0x0C: "Verification failed",        // The hash of the received firmware image does not match the hash in the init packet.
        0x0D: "Insufficient space"          // The available space on the device is insufficient to hold the firmware.
    };

    function secureDfu(crc32) {
        this.crc32 = crc32;
        this.events = {};
        this.notifyFns = {};
        this.controlChar = null;
        this.packetChar = null;
    }

    function createListenerFn(eventTypes) {
        return function(type, callback) {
            if (eventTypes.indexOf(type) < 0) return;
            if (!this.events[type]) this.events[type] = [];
            this.events[type].push(callback);
        };
    }
    function removeEventListener(type, callback) {
        if (!this.events[type]) return;
        let i = this.events[type].indexOf(callback);
        if (i >= 0) this.events[type].splice(i, 1);
        if (this.events[type].length === 0) delete this.events[type];
    }
    function dispatchEvent(event) {
        if (!this.events[event.type]) return;
        event.target = this;
        this.events[event.type].forEach(callback => {
            if (typeof callback === "function") callback(event);
        });
    }

    secureDfu.prototype.log = function(message) {
        this.dispatchEvent({
            type: "log",
            message: message
        });
    };

    secureDfu.prototype.progress = function(bytes) {
        this.dispatchEvent({
            type: "progress",
            object: "unknown",
            totalBytes: 0,
            currentBytes: bytes
        });
    };

    secureDfu.prototype.requestDevice = function(hiddenDfu, filters) {
        if (!hiddenDfu && !filters) {
            filters = [{ services: [SERVICE_UUID] }];
        }

        return bluetooth.requestDevice({
            filters: filters,
            acceptAllDevices: !filters,
            optionalServices: [SERVICE_UUID]
        })
        .then(device => {
            if (hiddenDfu) {
                return this.setDfuMode(device);
            }
            return device;
        });
    };

    secureDfu.prototype.setDfuMode = function(device) {
        return this.gattConnect(device)
        .then(characteristics => {
            this.log(`found ${characteristics.length} characteristic(s)`);

            let controlChar = characteristics.find(characteristic => {
                return (characteristic.uuid === CONTROL_UUID);
            });
            let packetChar = characteristics.find(characteristic => {
                return (characteristic.uuid === PACKET_UUID);
            });

            if (controlChar && packetChar) {
                return device;
            }

            let buttonChar = characteristics.find(characteristic => {
                return (characteristic.uuid === BUTTON_UUID);
            });

            if (!buttonChar) {
                throw new Error("Unsupported device");
            }

            // Support buttonless devices
            this.log("found buttonless characteristic");
            if (!buttonChar.properties.notify && !buttonChar.properties.indicate) {
                throw new Error("Buttonless characteristic does not allow notifications");
            }

            return buttonChar.startNotifications()
            .then(() => {
                this.log("enabled buttonless notifications");
                buttonChar.addEventListener("characteristicvaluechanged", this.handleNotification.bind(this));
                this.sendOperation(buttonChar, OPERATIONS.BUTTON_COMMAND);
            })
            .then(() => {
                this.log("sent dfu mode");
                return new Promise((resolve) => {
                    device.addEventListener("gattserverdisconnected", () => {
                        resolve();
                    });
                });
            });
        });
    };

    secureDfu.prototype.update = function(device, init, firmware) {
        if (!device) throw new Error("Device not specified");
        if (!init) throw new Error("Init not specified");
        if (!firmware) throw new Error("Firmware not specified");

        return this.connect(device)
        .then(() => {
            this.log("transferring init");
            return this.transferInit(init);
        })
        .then(() => {
            this.log("transferring firmware");
            return this.transferFirmware(firmware);
        })
        .then(() => {
            this.log("complete, disconnecting...");
            return new Promise((resolve) => {
                device.addEventListener("gattserverdisconnected", () => {
                    this.log("disconnected");
                    resolve();
                });
            });
        });
    };

    secureDfu.prototype.connect = function(device) {
        device.addEventListener("gattserverdisconnected", () => {
            this.controlChar = null;
            this.packetChar = null;
        });

        return this.gattConnect(device)
        .then(characteristics => {
            this.log(`found ${characteristics.length} characteristic(s)`);

            this.packetChar = characteristics.find(characteristic => {
                return (characteristic.uuid === PACKET_UUID);
            });
            if (!this.packetChar) throw new Error("Unable to find packet characteristic");
            this.log("found packet characteristic");

            this.controlChar = characteristics.find(characteristic => {
                return (characteristic.uuid === CONTROL_UUID);
            });
            if (!this.controlChar) throw new Error("Unable to find control characteristic");
            this.log("found control characteristic");

            if (!this.controlChar.properties.notify && !this.controlChar.properties.indicate) {
                throw new Error("Control characteristic does not allow notifications");
            }
            return this.controlChar.startNotifications();
        })
        .then(() => {
            this.controlChar.addEventListener("characteristicvaluechanged", this.handleNotification.bind(this));
            this.log("enabled control notifications");
            return device;
        });
    };

    secureDfu.prototype.gattConnect = function(device) {
        return Promise.resolve()
        .then(() => {
            if (device.gatt.connected) return device.gatt;
            return device.gatt.connect();
        })
        .then(server => {
            this.log("connected to gatt server");
            return server.getPrimaryService(SERVICE_UUID)
            .catch(() => {
                throw new Error("Unable to find DFU service");
            });
        })
        .then(service => {
            this.log("found DFU service");
            return service.getCharacteristics();
        });
    };

    secureDfu.prototype.handleNotification = function(event) {
        let view = event.target.value;

        if (OPERATIONS.RESPONSE.indexOf(view.getUint8(0)) < 0) {
            throw new Error("Unrecognised control characteristic response notification");
        }

        let operation = view.getUint8(1);
        if (this.notifyFns[operation]) {
            let result = view.getUint8(2);
            let error = null;

            if (result === 0x01) {
                let data = new DataView(view.buffer, 3);
                this.notifyFns[operation].resolve(data);
            } else if (result === 0x0B) {
                let code = view.getUint8(3);
                error = `Error: ${EXTENDED_ERROR[code]}`;
            } else {
                error = `Error: ${RESPONSE[result]}`;
            }

            if (error) {
                this.log(`notify: ${error}`);
                this.notifyFns[operation].reject(error);
            }
            delete this.notifyFns[operation];
        }
    };

    secureDfu.prototype.sendOperation = function(characteristic, operation, buffer) {
        return new Promise((resolve, reject) => {
            let size = operation.length;
            if (buffer) size += buffer.byteLength;

            let value = new Uint8Array(size);
            value.set(operation);
            if (buffer) {
                let data = new Uint8Array(buffer);
                value.set(data, operation.length);
            }

            this.notifyFns[operation[0]] = {
                resolve: resolve,
                reject: reject
            };

            characteristic.writeValue(value);
        });
    };

    secureDfu.prototype.sendControl = function(operation, buffer) {
        return this.sendOperation(this.controlChar, operation, buffer);
    };

    secureDfu.prototype.transferInit = function(buffer) {
        return this.transfer(buffer, "init", OPERATIONS.SELECT_COMMAND, OPERATIONS.CREATE_COMMAND);
    };

    secureDfu.prototype.transferFirmware = function(buffer) {
        return this.transfer(buffer, "firmware", OPERATIONS.SELECT_DATA, OPERATIONS.CREATE_DATA);
    };

    secureDfu.prototype.transfer = function(buffer, type, selectType, createType) {
        return this.sendControl(selectType)
        .then(response => {

            let maxSize = response.getUint32(0, LITTLE_ENDIAN);
            let offset = response.getUint32(4, LITTLE_ENDIAN);
            let crc = response.getInt32(8, LITTLE_ENDIAN);

            if (type === "init" && offset === buffer.byteLength && this.checkCrc(buffer, crc)) {
                this.log("init packet already available, skipping transfer");
                return;
            }

            this.progress = function(bytes) {
                this.dispatchEvent({
                    type: "progress",
                    object: type,
                    totalBytes: buffer.byteLength,
                    currentBytes: bytes
                });
            };
            this.progress(0);

            return this.transferObject(buffer, createType, maxSize, offset);
        });
    };

    secureDfu.prototype.transferObject = function(buffer, createType, maxSize, offset) {
        let start = offset - offset % maxSize;
        let end = Math.min(start + maxSize, buffer.byteLength);

        let view = new DataView(new ArrayBuffer(4));
        view.setUint32(0, end - start, LITTLE_ENDIAN);

        return this.sendControl(createType, view.buffer)
        .then(() => {
            let data = buffer.slice(start, end);
            return this.transferData(data, start);
        })
        .then(() => {
            return this.sendControl(OPERATIONS.CACULATE_CHECKSUM);
        })
        .then(response => {
            let crc = response.getInt32(4, LITTLE_ENDIAN);
            let transferred = response.getUint32(0, LITTLE_ENDIAN);
            let data = buffer.slice(0, transferred);

            if (this.checkCrc(data, crc)) {
                this.log(`written ${transferred} bytes`);
                offset = transferred;
                return this.sendControl(OPERATIONS.EXECUTE);
            } else {
                this.log("object failed to validate");
            }
        })
        .then(() => {
            if (end < buffer.byteLength) {
                return this.transferObject(buffer, createType, maxSize, offset);
            } else {
                this.log("transfer complete");
            }
        });
    };

    secureDfu.prototype.transferData = function(data, offset, start) {
        start = start || 0;
        let end = Math.min(start + PACKET_SIZE, data.byteLength);
        let packet = data.slice(start, end);

        return this.packetChar.writeValue(packet)
        .then(() => {
            this.progress(offset + end);

            if (end < data.byteLength) {
                return this.transferData(data, offset, end);
            }
        });
    };

    secureDfu.prototype.checkCrc = function(buffer, crc) {
        if (!this.crc32) {
            this.log("crc32 not found, skipping CRC check");
            return true;
        }

        return crc === this.crc32(new Uint8Array(buffer));
    };

    secureDfu.prototype.addEventListener = createListenerFn([ "log", "progress" ]);
    secureDfu.prototype.removeEventListener = removeEventListener;
    secureDfu.prototype.dispatchEvent = dispatchEvent;

    secureDfu.SERVICE_UUID = SERVICE_UUID;
    return secureDfu;
}));
