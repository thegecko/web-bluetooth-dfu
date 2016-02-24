# Web Bluetooth DFU
Device firmware update with Web Bluetooth

Update device firmware via [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) following the protocol here:

http://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk52.v0.9.2/bledfu_transport.html?cp=4_0_2_4_2_4

## Device Configuration

You will need an [nRF51](https://www.nordicsemi.com/Products/nRF51-DK) or [nRF52](https://www.nordicsemi.com/Products/Bluetooth-Smart-Bluetooth-low-energy/nRF52-DK) development kit, flashed with the appropriate image:

[nrf51_boot_s110.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf51_boot_s110.hex)

[nrf52_boot_s132.hex](https://thegecko.github.io/web-bluetooth-dfu/firmware/nrf52_boot_s132.hex)

## Web Example

Open this site in a [Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) enabled browser:

[https://thegecko.github.io/web-bluetooth-dfu/](https://thegecko.github.io/web-bluetooth-dfu/)

## Node Example

Clone this repository, install the npm dependencies and execute.

```
npm install
node example_node <device-type>
```

Where ```<device-type>``` is one of ```nrf51``` or ```nrf52```.