## Example Firmware Packages

These images were copied from the Nordic [nRF5 SDK version 14.2.0](http://www.nordicsemi.com/eng/nordic/Products/nRF52-DK/nRF5-SDK-zip/59014).

An entire device firmware can be broken down into three images, each of which can be update separately:

- Soft Device
- Bootloader
- Application

Each package can have up to two images in it, the first of which is _one_ of the following:

- Soft Device
- Bootloader
- Soft Device and Bootloader

The second image can then be an `application` image.

## bootloader_secure_ble_s132.zip

This package contains a single `bootloader` image which allows further updates from boot.

## softdevice_bootloader_secure_ble_s132.zip

This package contains a single image contaning both a `soft device` and a `bootloader`.

## ble_app_buttonless_dfu_s132.zip

This package contains a `buttonless application` image which allows futher updates without the need to physically touch the device.

## bootloader_secure_ble_app_buttonless_dfu_s132.zip

This package contains _two_ images; a `bootloader` and a `buttonless application` image which allows futher updates.

## ble_app_hrs_s140.zip

This package contains a heart rate monitor `application` which allows further updates. To activate the update mode, hold `button 4` while the device boots.
