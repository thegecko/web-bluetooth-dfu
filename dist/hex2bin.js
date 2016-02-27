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

    return function(hex) {
        var hexLines = hex.split("\n");
        var size = 0;

        hexLines.forEach(function(line) {
            if (line.substr(7, 2) === "00") { // type == data
                size += parseInt(line.substr(1, 2), 16);
            }
        });

        var buffer = new ArrayBuffer(size);
        var view = new Uint8Array(buffer);
        var pointer = 0;

        hexLines.forEach(function(line) {
            if (line.substr(7, 2) === "00") { // type == data
                var length = parseInt(line.substr(1, 2), 16);
                var data = line.substr(9, length * 2);
                for (var i = 0; i < length * 2; i += 2) {
                    view[pointer] = parseInt(data.substr(i, 2), 16);
                    pointer++;
                }
            }
        });

        return buffer;
    };
}));