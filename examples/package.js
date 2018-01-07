/*
* Web Bluetooth DFU
* Copyright (c) 2018 Rob Moran
*
* The MIT License (MIT)
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
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["jszip"], factory);
    } else if (typeof exports === "object") {
        // Node. Does not work with strict CommonJS
        module.exports = factory(require("jszip"));
    } else {
        // Browser globals with support for web workers (root is window)
        root.SecureDfuPackage = factory(root.JSZip);
    }
}(this, function(JSZip) {
    "use strict";

    function Package(buffer) {
        this.buffer = buffer;
        this.zipFile = null;
        this.manifest = null;
    };

    Package.prototype.load = function() {
        return JSZip.loadAsync(this.buffer)
        .then(zipFile => {
            this.zipFile = zipFile;
            try {
                return this.zipFile.file("manifest.json").async("string");
            } catch(e) {
                throw new Error("Unable to find manifest, is this a proper DFU package?");
            }
        })
        .then(content => {
            this.manifest = JSON.parse(content).manifest;
            return this;
        });
    };

    Package.prototype.getImage = function(types) {
        for (var type of types) {
            if (this.manifest[type]) {
                var entry = this.manifest[type];
                var result = {
                    type: type,
                    initFile: entry.dat_file,
                    imageFile: entry.bin_file
                };
    
                return this.zipFile.file(result.initFile).async("arraybuffer")
                .then(data => {
                    result.initData = data;
                    return this.zipFile.file(result.imageFile).async("arraybuffer")
                })
                .then(data => {
                    result.imageData = data;
                    return result;
                });
            }
        }
    };

    Package.prototype.getBaseImage = function() {
        return this.getImage(["softdevice", "bootloader", "softdevice_bootloader"]);
    };

    Package.prototype.getAppImage = function() {
        return this.getImage(["application"]);
    };

    return Package;
}));
