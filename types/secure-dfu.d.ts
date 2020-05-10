/// <reference types="web-bluetooth" />
import { EventDispatcher } from "./dispatcher";
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
export interface UuidOptions {
    service?: number | string;
    button?: number | string;
    control?: number | string;
    packet?: number | string;
}
/**
 * Secure Device Firmware Update class
 */
export declare class SecureDfu extends EventDispatcher {
    private crc32;
    private bluetooth?;
    private delay;
    /**
     * DFU Service unique identifier
     */
    static SERVICE_UUID: number;
    /**
     * Log event
     * @event
     */
    static EVENT_LOG: string;
    /**
     * Progress event
     * @event
     */
    static EVENT_PROGRESS: string;
    private DEFAULT_UUIDS;
    private notifyFns;
    private controlChar;
    private packetChar;
    /**
     * Characteristic constructor
     * @param bluetooth A bluetooth instance
     * @param crc32 A CRC32 function
     * @param delay Milliseconds of delay between packets
     */
    constructor(crc32: (data: Array<number> | Uint8Array, seed?: number) => number, bluetooth?: Bluetooth, delay?: number);
    private log;
    private progress;
    private connect;
    private gattConnect;
    private handleNotification;
    private sendOperation;
    private sendControl;
    private transferInit;
    private transferFirmware;
    private transfer;
    private transferObject;
    private transferData;
    private checkCrc;
    private delayPromise;
    /**
     * Scans for a device to update
     * @param buttonLess Scans for all devices and will automatically call `setDfuMode`
     * @param filters Alternative filters to use when scanning
     * @param uuids Optional alternative uuids for service, control, packet or button
     * @returns Promise containing the device
     */
    requestDevice(buttonLess: boolean, filters: Array<BluetoothLEScanFilterInit>, uuids?: UuidOptions): Promise<BluetoothDevice>;
    /**
     * Sets the DFU mode of a device, preparing it for update
     * @param device The device to switch mode
     * @param uuids Optional alternative uuids for control, packet or button
     * @returns Promise containing the device if it is still on a valid state
     */
    setDfuMode(device: BluetoothDevice, uuids?: UuidOptions): Promise<BluetoothDevice>;
    /**
     * Updates a device
     * @param device The device to switch mode
     * @param init The initialisation packet to send
     * @param firmware The firmware to update
     * @returns Promise containing the device
     */
    update(device: BluetoothDevice, init: ArrayBuffer, firmware: ArrayBuffer): Promise<BluetoothDevice>;
}
