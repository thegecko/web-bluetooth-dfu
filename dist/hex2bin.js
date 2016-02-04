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