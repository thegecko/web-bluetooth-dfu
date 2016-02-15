# Web Bluetooth DFU
Device firmware update with Web Bluetooth

Update device firmware via [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) using the protocol here:

[http://developer.nordicsemi.com/nRF51_SDK/nRF51_SDK_v8.x.x/doc/8.1.0/s110/html/a00103.html](http://developer.nordicsemi.com/nRF51_SDK/nRF51_SDK_v8.x.x/doc/8.1.0/s110/html/a00103.html)

## Device Configuration

Put this firmware onto an [nrf51822](https://www.nordicsemi.com/eng/Products/nRF51-DK):

[NRF51822_DFU_Test_BOOT.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/NRF51822_DFU_Test_BOOT.hex)

Then reset the device.

## Web Example

Open this site in a Web Bluetooth enabled browser:

[https://thegecko.github.io/web-bluetooth-dfu/](https://thegecko.github.io/web-bluetooth-dfu/)

## Node Example

Install the npm dependencies and run.

```
npm install
node example_node
```