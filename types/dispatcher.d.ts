/// <reference types="node" />
import { EventEmitter } from "events";
/**
 * @hidden
 */
export declare class EventDispatcher extends EventEmitter {
    addEventListener(event: string | symbol, listener: (...args: any[]) => void): this;
    removeEventListener(event: string | symbol, listener: (...args: any[]) => void): this;
    dispatchEvent(eventType: string | symbol, event?: any): boolean;
}
