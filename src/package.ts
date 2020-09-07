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

import JSZip from "jszip";

export type ManifestType = keyof Manifest;

export interface Manifest {
  application: FirmwareData;
  bootloader: FirmwareData;
  softdevice: FirmwareData;
  softdevice_bootloader: FirmwareData;
}

export interface FirmwareData {
  bin_file: string;
  dat_file: string;
}

export interface FirmwareImage {
  type: ManifestType;
  initFile: string;
  imageFile: string;
  initData: ArrayBuffer;
  imageData: ArrayBuffer;
}

export class DistributionPackage {
  public static async fromZIP(data: Buffer): Promise<DistributionPackage> {
    const zipFile = await JSZip.loadAsync(data);
    const manifestFile = await zipFile.file("manifest.json")?.async("string");
    if (manifestFile === undefined) {
      throw new Error("manifest file not found.");
    }
    const { manifest }: { manifest: Manifest } = JSON.parse(manifestFile);
    return new this(zipFile, manifest);
  }

  private zipFile: JSZip;
  private manifest: Manifest;

  private constructor(zipFile: JSZip, manifest: Manifest) {
    this.zipFile = zipFile;
    this.manifest = manifest;
  }

  public async getImage(...types: ManifestType[]): Promise<FirmwareImage | undefined> {
    for (const type of types) {
      const entry = this.manifest[type];
      if (entry === undefined) {
        continue;
      }
      const initData = await this.zipFile.file(entry.dat_file)?.async("arraybuffer");
      const imageData = await this.zipFile.file(entry.bin_file)?.async("arraybuffer");
      if (initData && imageData) {
        return {
          type,
          initFile: entry.dat_file,
          initData,
          imageFile: entry.bin_file,
          imageData,
        };
      }
    }
    return;
  }

  public getBaseImage(): Promise<FirmwareImage | undefined> {
    return this.getImage("softdevice", "bootloader", "softdevice_bootloader");
  }

  public getAppImage(): Promise<FirmwareImage | undefined> {
    return this.getImage("application");
  }
}
