/* @license
 *
 * Hex to Bin library
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
(function(global, factory) {
    if (typeof exports === 'object') {
        // CommonJS (Node)
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(factory);
    } else {
        // Browser global (with support for web workers)
        global.hex2bin = factory();
    }
}(this, function() {
    'use strict';
    
    var RecordType = { // I32HEX files use only record types 00, 01, 04, 05.
        DATA : '00',
        END_OF_FILE : '01',
        EXTENDED_SEGMENT_ADDRESS : '02',
        START_SEGMENT_ADDRESS : '03',
        EXTENDED_LINEAR_ADDRESS : '04',
        START_LINEAR_ADDRESS: '05'
    };
    
    /**
     * The first record of type extended linear address in the provided hex file will store the start base address of the binary.
     * Then the first data record's address offset will complete our start address.
     */
    function helperGetBinaryStartAddress(hexLines) {
        var record;
        
        do {
            record = hexLines.shift();
        } while (record.substr(7, 2) != RecordType.EXTENDED_LINEAR_ADDRESS);
        
        var firstBaseAddress = parseInt(record.substr(9, 4), 16) << 16;
        
        do {
            record = hexLines.shift();
        } while (record.substr(7, 2) != RecordType.DATA);
        var firstDataRecordAddressOffset = parseInt(record.substr(3, 4), 16);

        var startAddress = firstBaseAddress + firstDataRecordAddressOffset;
        log('start address of binary: ' + startAddress);
        return startAddress;
    }
    
    /**
     * The last record of type extended linear address in the provided hex file will store the base address of the last data segment in the binary.
     * Then the last record of type data will store the address offset and length of data to be stored here to complete the base address and obtain maxAddress.
     */
    function helperGetBinaryEndAddress(hexLines, maxAddress) {
        var record;
        
        do {
            record = hexLines.pop();
        } while (record.substr(7, 2) != RecordType.DATA);
        
        var lastDataRecordLength = parseInt(record.substr(1, 2), 16);
        var lastDataRecordAddressOffset = parseInt(record.substr(3, 4), 16);
        
        do {
            record = hexLines.pop();
        } while (record.substr(7, 2) != RecordType.EXTENDED_LINEAR_ADDRESS);
        
        var lastBaseAddress = parseInt(record.substr(9, 4), 16) << 16;
        
        var endAddress = lastBaseAddress + lastDataRecordAddressOffset + lastDataRecordLength;
        if (endAddress > maxAddress) {
            return helperGetBinaryEndAddress(hexLines, maxAddress);
        }
        log('end address of binary: ' + endAddress);
        return endAddress;
    }
    
    /**
     * Converts a hex file to a binary blob and returns the data as a buffer.
     * @param hex - hex file of either SoftDevice, Application or Bootloader to be transferred OTA to the device. Must be a valid Intel 32 hex file.
     * @param minAddress - the first address (i.e. when updating the SoftDevice we don't send the Master Boot Record).
     * @param maxAddress - the last address in the devices flash.
     * @return a buffer of bytes that corresponds to the inputs of this function and is padded with 0xFF in gaps between data segments in the hex file.
     * Any data in addresses under minAddress will be cut off along with any data in addresses above maxAddress (required by Nordic's DFU protocol).
     * This is because we are not to send the Master Boot Record (under minAddress) when updating the SoftDevice.
     * And we are not to send UICR data (above maxAddress) when updating the bootloader or application.
     */
    return function(hex, minAddress, maxAddress) {
        maxAddress = maxAddress || 0x80000; // This will always cut off the UICR and the user will not have to every specify this parameter.
        minAddress = minAddress || 0x0;
        
        var startAddress = helperGetBinaryStartAddress(hex.split("\n"), minAddress);
        var endAddress = helperGetBinaryEndAddress(hex.split("\n"), maxAddress);
        
        if (startAddress < minAddress) {
            startAddress = minAddress;
            log('trimmed start address of binary: ' + startAddress);
        }
        
        var binarySizeBytes = endAddress - startAddress;

        var buffer = new ArrayBuffer(binarySizeBytes);
        var view = new Uint8Array(buffer);
        view.fill(0xFF); // Pad the binary blob with 0xFF as this corresponds to erased 'unwritten' flash.
        
        var baseAddress;

        var hexLines = hex.split("\n");
        hexLines.forEach(function(line) {
            
            switch (line.substr(7, 2)) {
              
                case RecordType.DATA:
                    var length = parseInt(line.substr(1, 2), 16);
                    var addressOffset = parseInt(line.substr(3, 4), 16);
                    var data = line.substr(9, length * 2);
                    for (var i = 0; i < length * 2; i += 2) {
                        var index = (baseAddress + addressOffset) - startAddress + (i / 2);
                        if (index >= 0 && index < binarySizeBytes) { // This cuts off any data below minAddress and above maxAddress.
                            view[index] = parseInt(data.substr(i, 2), 16);
                        }
                    }
                    break;
                case RecordType.END_OF_FILE:
                    log('done converting hex file to binary');
                    break;
                case RecordType.EXTENDED_SEGMENT_ADDRESS:
                    throw 'ERROR - invalid hex file - extended segment address is not handled';
                case RecordType.START_SEGMENT_ADDRESS:
                    throw 'ERROR - invalid hex file - start segment address is not handled';
                case RecordType.EXTENDED_LINEAR_ADDRESS:
                    baseAddress = parseInt(line.substr(9, 4), 16) << 16;
                    break;
                case RecordType.START_LINEAR_ADDRESS:
                    log('ignore records of type start linear address');
                    break;
                default:
                    if (line === '') {
                        break;
                    } else {
                        throw 'ERROR - invalid hex file - unexpected record type in provided hex file';
                    }
                    
            }
            
        });
        return buffer;
    };
}));
