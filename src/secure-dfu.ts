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

import { EventDispatcher } from "./dispatcher";

const CONTROL_UUID = "8ec90001-f315-4f60-9fb8-838830daea50";
const PACKET_UUID = "8ec90002-f315-4f60-9fb8-838830daea50";
const BUTTON_UUID = "8ec90003-f315-4f60-9fb8-838830daea50";

const LITTLE_ENDIAN = true;
const PACKET_SIZE = 20;

const OPERATIONS = {
    BUTTON_COMMAND:         [ 0x01 ],
    CREATE_COMMAND:         [ 0x01, 0x01 ],
    CREATE_DATA:            [ 0x01, 0x02 ],
    RECEIPT_NOTIFICATIONS:  [ 0x02 ],
    CACULATE_CHECKSUM:      [ 0x03 ],
    EXECUTE:                [ 0x04 ],
    SELECT_COMMAND:         [ 0x06, 0x01 ],
    SELECT_DATA:            [ 0x06, 0x02 ],
    RESPONSE:               [ 0x60, 0x20 ]
};

const RESPONSE = {
    // Invalid code
    0x00: "Invalid opcode",
    // Success
    0x01: "Operation successful",
    // Opcode not supported
    0x02: "Opcode not supported",
    // Invalid parameter
    0x03: "Missing or invalid parameter value",
    // Insufficient resources
    0x04: "Not enough memory for the data object",
    // Invalid object
    0x05: "Data object does not match the firmware and hardware requirements, the signature is wrong, or parsing the command failed",
    // Unsupported type
    0x07: "Not a valid object type for a Create request",
    // Operation not permitted
    0x08: "The state of the DFU process does not allow this operation",
    // Operation failed
    0x0A: "Operation failed",
    // Extended error
    0x0B: "Extended error"
};

const EXTENDED_ERROR = {
    // No error
    0x00: "No extended error code has been set. This error indicates an implementation problem",
    // Invalid error code
    0x01: "Invalid error code. This error code should never be used outside of development",
    // Wrong command format
    0x02: "The format of the command was incorrect",
    // Unknown command
    0x03: "The command was successfully parsed, but it is not supported or unknown",
    // Init command invalid
    0x04: "The init command is invalid. The init packet either has an invalid update type or it is missing required fields for the update type",
    // Firmware version failure
    0x05: "The firmware version is too low. For an application, the version must be greater than the current application. For a bootloader, it must be greater than or equal to the current version",
    // Hardware version failure
    0x06: "The hardware version of the device does not match the required hardware version for the update",
    // Softdevice version failure
    0x07: "The array of supported SoftDevices for the update does not contain the FWID of the current SoftDevice",
    // Signature missing
    0x08: "The init packet does not contain a signature",
    // Wrong hash type
    0x09: "The hash type that is specified by the init packet is not supported by the DFU bootloader",
    // Hash failed
    0x0A: "The hash of the firmware image cannot be calculated",
    // Wrong signature type
    0x0B: "The type of the signature is unknown or not supported by the DFU bootloader",
    // Verification failed
    0x0C: "The hash of the received firmware image does not match the hash in the init packet",
    // Insufficient space
    0x0D: "The available space on the device is insufficient to hold the firmware"
};

/**
 * BluetoothLE Scan Filter Init interface
 */
export interface BluetoothLEScanFilterInit {
    /**
     * An array of service UUIDs to filter on
     */
    services?: Array<string | number>;

    /**
     * The device name to filter on
     */
    name?: string;

    /**
     * The device name prefix to filter on
     */
    namePrefix?: string;
}

/**
 * Secure Device Firmware Update class
 */
export class SecureDfu extends EventDispatcher {

    /**
     * DFU Service unique identifier
     */
    public static SERVICE_UUID: number = 0xFE59;

    /**
     * Log event
     * @event
     */
    public static EVENT_LOG: string = "log";

    /**
     * Progress event
     * @event
     */
    public static EVENT_PROGRESS: string = "progress";

    private notifyFns: {} = {};
    private controlChar: BluetoothRemoteGATTCharacteristic = null;
    private packetChar: BluetoothRemoteGATTCharacteristic = null;

    /**
     * Characteristic constructor
     * @param bluetooth A bluetooth instance
     * @param crc32 A CRC32 function
     * @param delay Milliseconds of delay between packets
     */
    constructor(private crc32: (data: Array<number> | Uint8Array, seed?: number) => number,
                private bluetooth?: Bluetooth,
                private delay: number = 0) {
        super();

        if (!this.bluetooth && window && window.navigator && window.navigator.bluetooth) {
            this.bluetooth = navigator.bluetooth;
        }
    }

    private log(message: string) {
        this.dispatchEvent(SecureDfu.EVENT_LOG, {
            message: message
        });
    }

    private progress(bytes: number) {
        this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
            object: "unknown",
            totalBytes: 0,
            currentBytes: bytes
        });
    }

    private connect(device: BluetoothDevice): Promise<BluetoothDevice> {
        device.addEventListener("gattserverdisconnected", () => {
            this.notifyFns = {};
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
    }

    private gattConnect(device: BluetoothDevice): Promise<Array<BluetoothRemoteGATTCharacteristic>> {
        return Promise.resolve()
        .then(() => {
            if (device.gatt.connected) return device.gatt;
            return device.gatt.connect();
        })
        .then(server => {
            this.log("connected to gatt server");
            return server.getPrimaryService(SecureDfu.SERVICE_UUID)
            .catch(() => {
                throw new Error("Unable to find DFU service");
            });
        })
        .then(service => {
            this.log("found DFU service");
            return service.getCharacteristics();
        });
    }

    private handleNotification(event: any) {
        const view = event.target.value;

        if (OPERATIONS.RESPONSE.indexOf(view.getUint8(0)) < 0) {
            throw new Error("Unrecognised control characteristic response notification");
        }

        const operation = view.getUint8(1);
        if (this.notifyFns[operation]) {
            const result = view.getUint8(2);
            let error = null;

            if (result === 0x01) {
                const data = new DataView(view.buffer, 3);
                this.notifyFns[operation].resolve(data);
            } else if (result === 0x0B) {
                const code = view.getUint8(3);
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
    }

    private sendOperation(characteristic: BluetoothRemoteGATTCharacteristic, operation: Array<number>, buffer?: ArrayBuffer): Promise<DataView> {
        return new Promise((resolve, reject) => {
            let size = operation.length;
            if (buffer) size += buffer.byteLength;

            const value = new Uint8Array(size);
            value.set(operation);
            if (buffer) {
                const data = new Uint8Array(buffer);
                value.set(data, operation.length);
            }

            this.notifyFns[operation[0]] = {
                resolve: resolve,
                reject: reject
            };

            characteristic.writeValue(value);
        });
    }

    private sendControl(operation: Array<number>, buffer?: ArrayBuffer): Promise<DataView> {
        return this.sendOperation(this.controlChar, operation, buffer);
    }

    private transferInit(buffer: ArrayBuffer): Promise<DataView> {
        return this.transfer(buffer, "init", OPERATIONS.SELECT_COMMAND, OPERATIONS.CREATE_COMMAND);
    }

    private transferFirmware(buffer: ArrayBuffer): Promise<DataView> {
        return this.transfer(buffer, "firmware", OPERATIONS.SELECT_DATA, OPERATIONS.CREATE_DATA);
    }

    private transfer(buffer: ArrayBuffer, type: string, selectType: Array<number>, createType: Array<number>): Promise<DataView> {
        return this.sendControl(selectType)
        .then(response => {

            const maxSize = response.getUint32(0, LITTLE_ENDIAN);
            const offset = response.getUint32(4, LITTLE_ENDIAN);
            const crc = response.getInt32(8, LITTLE_ENDIAN);

            if (type === "init" && offset === buffer.byteLength && this.checkCrc(buffer, crc)) {
                this.log("init packet already available, skipping transfer");
                return;
            }

            this.progress = bytes => {
                this.dispatchEvent(SecureDfu.EVENT_PROGRESS, {
                    object: type,
                    totalBytes: buffer.byteLength,
                    currentBytes: bytes
                });
            };
            this.progress(0);

            return this.transferObject(buffer, createType, maxSize, offset);
        });
    }

    private transferObject(buffer: ArrayBuffer, createType: Array<number>, maxSize: number, offset: number): Promise<DataView> {
        const start = offset - offset % maxSize;
        const end = Math.min(start + maxSize, buffer.byteLength);

        const view = new DataView(new ArrayBuffer(4));
        view.setUint32(0, end - start, LITTLE_ENDIAN);

        return this.sendControl(createType, view.buffer)
        .then(() => {
            const data = buffer.slice(start, end);
            return this.transferData(data, start);
        })
        .then(() => {
            return this.sendControl(OPERATIONS.CACULATE_CHECKSUM);
        })
        .then(response => {
            const crc = response.getInt32(4, LITTLE_ENDIAN);
            const transferred = response.getUint32(0, LITTLE_ENDIAN);
            const data = buffer.slice(0, transferred);

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
    }

    private transferData(data: ArrayBuffer, offset: number, start?: number) {
        start = start || 0;
        const end = Math.min(start + PACKET_SIZE, data.byteLength);
        const packet = data.slice(start, end);

        return this.packetChar.writeValue(packet)
        .then(() => this.delayPromise(this.delay))
        .then(() => {
            this.progress(offset + end);

            if (end < data.byteLength) {
                return this.transferData(data, offset, end);
            }
        });
    }

    private checkCrc(buffer: ArrayBuffer, crc: number): boolean {
        if (!this.crc32) {
            this.log("crc32 not found, skipping CRC check");
            return true;
        }

        return crc === this.crc32(new Uint8Array(buffer));
    }

    private delayPromise(delay: number) {
        return new Promise(resolve => {
            setTimeout(resolve, delay);
        });
    }

    /**
     * Scans for a device to update
     * @param buttonLess Scans for all devices and will automatically call `setDfuMode`
     * @param filters Alternative filters to use when scanning
     * @returns Promise containing the device
     */
    public requestDevice(buttonLess: boolean, filters: Array<BluetoothLEScanFilterInit>): Promise<BluetoothDevice> {
        if (!buttonLess && !filters) {
            filters = [ { services: [ SecureDfu.SERVICE_UUID ] } ];
        }

        const options: any = {
            optionalServices: [ SecureDfu.SERVICE_UUID ]
        };

        if (filters) options.filters = filters;
        else options.acceptAllDevices = true;

        return this.bluetooth.requestDevice(options)
        .then(device => {
            if (buttonLess) {
                return this.setDfuMode(device);
            }
            return device;
        });
    }

    /**
     * Sets the DFU mode of a device, preparing it for update
     * @param device The device to switch mode
     * @returns Promise containing the device if it is still on a valid state
     */
    public setDfuMode(device: BluetoothDevice): Promise<BluetoothDevice> {
        return this.gattConnect(device)
        .then(characteristics => {
            this.log(`found ${characteristics.length} characteristic(s)`);

            const controlChar = characteristics.find(characteristic => {
                return (characteristic.uuid === CONTROL_UUID);
            });

            const packetChar = characteristics.find(characteristic => {
                return (characteristic.uuid === PACKET_UUID);
            });

            if (controlChar && packetChar) {
                return device;
            }

            const buttonChar = characteristics.find(characteristic => {
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

            return new Promise<BluetoothDevice>((resolve, _reject) => {

                function complete() {
                    this.notifyFns = {};
                    // Resolve with null device as it needs reconnecting
                    resolve(null);
                }

                buttonChar.startNotifications()
                .then(() => {
                    this.log("enabled buttonless notifications");

                    device.addEventListener("gattserverdisconnected", complete.bind(this));
                    buttonChar.addEventListener("characteristicvaluechanged", this.handleNotification.bind(this));

                    return this.sendOperation(buttonChar, OPERATIONS.BUTTON_COMMAND);
                })
                .then(() => {
                    this.log("sent DFU mode");
                    complete();
                });
            });
        });
    }

    /**
     * Updates a device
     * @param device The device to switch mode
     * @param init The initialisation packet to send
     * @param firmware The firmware to update
     * @returns Promise containing the device
     */
    public update(device: BluetoothDevice, init: ArrayBuffer, firmware: ArrayBuffer): Promise<BluetoothDevice> {
        return new Promise((resolve, reject) => {
            if (!device) return reject("Device not specified");
            if (!init) return reject("Init not specified");
            if (!firmware) return reject("Firmware not specified");

            this.connect(device)
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

                device.addEventListener("gattserverdisconnected", () => {
                    this.log("disconnected");
                    resolve(device);
                });
            })
            .catch(error => reject(error));
        });
    }
}
