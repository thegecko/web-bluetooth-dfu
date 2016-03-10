# Web Bluetooth DFU

[![Circle CI](https://img.shields.io/circleci/project/thegecko/web-bluetooth-dfu.svg)](https://circleci.com/gh/thegecko/web-bluetooth-dfu)
[![Bower](https://img.shields.io/bower/v/web-bluetooth-dfu.svg)](http://bower.io/search/?q=web-bluetooth-dfu)
[![npm](https://img.shields.io/npm/dm/web-bluetooth-dfu.svg)](https://www.npmjs.com/package/web-bluetooth-dfu)
[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](http://opensource.org/licenses/MIT)

Device firmware update with Web Bluetooth

Update device firmware via [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) following the protocol here:

http://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk52.v0.9.2/bledfu_transport.html?cp=4_0_2_4_2_4

## Device Configuration

You will need an [nRF51](https://www.nordicsemi.com/Products/nRF51-DK) or [nRF52](https://www.nordicsemi.com/Products/Bluetooth-Smart-Bluetooth-low-energy/nRF52-DK) development kit, flashed with the appropriate image:

[nrf51_boot_s110.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf51_boot_s110.hex) - an [mbed](http://www.mbed.com/) bootloader merged with Nordic's s110 SoftDevice

[nrf52_boot_s132.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_boot_s132.hex) - Nordic's bootloader merged with Nordic's s132 SoftDevice

Upon flashing the device will be in bootloader mode and ready to receive a DFU transfer.

## Web Example

Open this site in a [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) enabled browser:

[https://thegecko.github.io/web-bluetooth-dfu/](https://thegecko.github.io/web-bluetooth-dfu/)

## Node Example

Clone this repository, install the npm dependencies and execute.

```
$ npm install
$ node example_node <device-type>
```

Where ```<device-type>``` is one of ```nrf51``` or ```nrf52```.

## Updating the SoftDevice or Bootloader

The ```.hex``` files below can be transferred via DFU to test SoftDevice and Bootloader updates respectivley:

[nrf52_softdevice_only.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_softdevice_only.hex) - Nordic's s132 SoftDevice

[nrf52_bootloader_only.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_bootloader_only.hex) - Nordic's standard bootloader

Note: Currently updating the SoftDevice and Bootloader at the same time is not supported.