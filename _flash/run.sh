#!/bin/bash

set -e

./nrfjprog --family NRF52 --eraseall
./nrfjprog --family NRF52 --program s132_nrf52_5.1.0_softdevice.hex --sectorerase --reset
./nrfjprog --family NRF52 --program secure_dfu_ble_s132_pca10040_debug.hex --sectoranduicrerase --reset
