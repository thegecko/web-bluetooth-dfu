/* @license
 *
 * CRC-CCITT (0xFFFF) library.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2016
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
        global.crc16 = factory();
    }
}(this, function() {
    'use strict';

    /**
     * Copied from Nordic's command line tool nrf.exe.
     * https://github.com/NordicSemiconductor/pc-nrfutil/blob/master/nordicsemi/dfu/crc16.py
     * CRC-CCITT (0xFFFF).
     */
    return function (binaryData) {
        var crc = 0xFFFF;
        var view = new Uint8Array(binaryData);
        
        var i;
        
        for (i = 0; i < view.byteLength; i++) {
            crc = (crc >> 8 & 0x00FF) | (crc << 8 & 0xFF00);
            crc ^= view[i];
            crc ^= (crc & 0x00FF) >> 4;
            crc ^= (crc << 8) << 4;
            crc ^= ((crc & 0x00FF) << 4) << 1;
        }
        
        return (crc & 0xFFFF);
    };
}));
