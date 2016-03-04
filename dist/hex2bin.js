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
    
    var RECORD_TYPE = { // I32HEX files use only record types 00, 01, 04, 05.
        DATA : '00',
        END_OF_FILE : '01',
        EXTENDED_SEGMENT_ADDRESS : '02',
        START_SEGMENT_ADDRESS : '03',
        EXTENDED_LINEAR_ADDRESS : '04',
        START_LINEAR_ADDRESS: '05'
    };
    
    /**
     * Returns the size, in bytes, of the provided hex file.
     * NOTE: the binary we generate may be bigger than this size because of padding.
     * Really this is just a sanity check for now. If the binary is much bigger than the hex then we probably have some kind of an error.
     */
    function helperGetHexSize(hex) {
        var hexLines = hex.split("\n");
        var size = 0;
        hexLines.forEach(function(line) {
            if (line.substr(7, 2) === RECORD_TYPE.DATA) {
                size += parseInt(line.substr(1, 2), 16);
            }
        });
        log('hex size: ' + size);
        return size;
    }
    
    /**
     * The first record of type extended linear address will store the start base address of the binary.
     * Then the first data record's address offset will complete our start address.
     */
    function helperGetBinaryStartAddress(hex) {
        var hexLines = hex.split("\n");
        var record;
        
        do {
            record = hexLines.shift();
        } while (record.substr(7, 2) != RECORD_TYPE.EXTENDED_LINEAR_ADDRESS);
        
        var firstBaseAddress = parseInt(record.substr(9, 4), 16) << 16;
        
        do {
            record = hexLines.shift();
        } while (record.substr(7, 2) != RECORD_TYPE.DATA);
        var firstDataRecordAddressOffset = parseInt(record.substr(3, 4), 16);

        var startAddress = firstBaseAddress + firstDataRecordAddressOffset;
        log('start address of binary: ' + startAddress);
        return startAddress;
    }
    
    /**
     * The last record of type data will store the address offset and length of the data stored at that address.
     * Then the last extended linear address record's base address will complete our end address.
     */
    function helperGetBinaryEndAddress(hex) {
        var hexLines = hex.split("\n");
        var record;
        
        do {
            record = hexLines.pop();
        } while (record.substr(7, 2) != RECORD_TYPE.DATA);
        
        var lastDataRecordLength = parseInt(record.substr(1, 2), 16);
        var lastDataRecordAddressOffset = parseInt(record.substr(3, 4), 16);
        
        do {
            record = hexLines.pop();
        } while (record.substr(7, 2) != RECORD_TYPE.EXTENDED_LINEAR_ADDRESS);
        
        var lastBaseAddress = parseInt(record.substr(9, 4), 16) << 16;
        
        var endAddress = lastBaseAddress + lastDataRecordAddressOffset + lastDataRecordLength;
        log('end address of binary: ' + endAddress);
        return endAddress;
    }
    
    /**
     * Converts a hex file to a binary blob and returns the data as a buffer.
     * Any gaps in the hex file are padded with 0xFF in the buffer.
     * Any data in addresses under minAddress will be cut off along with any data in addresses above maxAddress.
     * This is because we are not to send the Master Boot Recrod (under minAddress) when updating the SoftDevice.
     * And we are not to send UICR data (above maxAddress) when updating the bootloader or application.
     */
    return function(hex, minAddress, maxAddress) {
        var hexLines = hex.split("\n");
        
        var hexSizeBytes = helperGetHexSize(hex);
        var startAddress = helperGetBinaryStartAddress(hex);
        var endAddress = helperGetBinaryEndAddress(hex);
        
        if (startAddress < minAddress) {
            startAddress = minAddress;
        }
        if (endAddress > maxAddress) {
            endAddress = maxAddress;
        }
        
        var binarySizeBytes = endAddress - startAddress;

        var buffer = new ArrayBuffer(binarySizeBytes);
        var view = new Uint8Array(buffer);
        view.fill(0xFF); // Pad the binary blob with 0xFF as this corresponds to erased 'unwritten' flash.
        
        var baseAddress;

        hexLines.forEach(function(line) {
            
            switch (line.substr(7, 2)) {
              
                case RECORD_TYPE.DATA:
                    var length = parseInt(line.substr(1, 2), 16);
                    var addressOffset = parseInt(line.substr(3, 4), 16);
                    var data = line.substr(9, length * 2);
                    for (var i = 0; i < length * 2; i += 2) {
                        var index = (baseAddress + addressOffset) - startAddress + (i / 2);
                        if (index > 0 || index <= binarySizeBytes) {
                            view[index] = parseInt(data.substr(i, 2), 16);
                        }
                    }
                    break;
                case RECORD_TYPE.END_OF_FILE:
                    log('done converting hex file to binary');
                    break;
                case RECORD_TYPE.EXTENDED_SEGMENT_ADDRESS:
                    throw 'ERROR - invalid hex file - extended segment address is not handled';
                case RECORD_TYPE.START_SEGMENT_ADDRESS:
                    throw 'ERROR - invalid hex file - start segment address is for 80x86 processors';
                case RECORD_TYPE.EXTENDED_LINEAR_ADDRESS:
                    baseAddress = parseInt(line.substr(9, 4), 16) << 16;
                    break;
                case RECORD_TYPE.START_LINEAR_ADDRESS:
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