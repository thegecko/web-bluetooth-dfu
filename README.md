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

[nrf51_boot_s110.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf51_boot_s110.hex). The mbed bootloader merged with Nordic's s110 SoftDevice. Upon flashing the device will be in bootloader mode and ready to receive a DFU transfer.

[nrf52_boot_s132.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_boot_s132.hex). Nordic's bootloader merged with Nordic's s132 SoftDevice. Upon flashing the device will be in bootloader mode and ready to receive a DFU transfer.

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

When updating the application nothing special needs to be done - the only input required is APPLICATION.hex. However it is possible to update the SoftDevice or Bootloader as well. The user will need to specify the image type of the update
when transferring a SoftDevice or Bootloader in dfu.provision() (i.e. dfu.provision(device, buffer, dfu.ImageType.SoftDevice);) along with the following:

Softdevice: When updating the SoftDevice we must not rewrite the [Master Boot Record (MBR)](https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.s132.sds.v0.5/dita/softdevices/s130/mbr_bootloader/mbr_bootloader.html?cp=1_3_0_0_9).
As the MBR is included in Nordic's SoftDevices at the beggining of FLASH, the end address of the MBR will need to be specified when converting the hex file (i.e. hex2bin(softdevice.hex, 0x1000);). This way when updating the SoftDevice
the current MBR already on the device will be preserved, but the SoftDevice will be replaced. User is responsible for determining the end address of the MBR for their specific SoftDevice and specifying this as an input to hex2bin.
The .hex file below can be transferred via DFU to test SoftDevice updates.

[nrf52_softdevice_only.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_softdevice_only.hex). Nordic's s132 SoftDevice (nRF52 only).

Bootloader: When updating the bootloader we must not rewrite the [UICR](https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.nrf52832.ps.v1.0/uicr.html?cp=1_2_0_12#concept_rnp_grp_xr). The UICR is a special page of FLASH located
in a different memory region on Nordic Devices. Nordic's DFU protocol does not support transferring data that is located in this memory region, and thus it needs to be trimmed off of our BOOTLOADER.hex file. However hex2bin will
take care of this automatically and no special care needs to be taken when doing this type of update. The .hex file below can be transferred via DFU to test bootloader updates.

[nrf52_bootloader_only.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_bootloader_only.hex). Nordic's standard bootloader (nRF52 only).

Note: Currently updating the SoftDevice and Bootloader at the same time is not supported.
