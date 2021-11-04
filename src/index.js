import { loadWasm } from "../loadwasm.js";
import aac from '../aac.js';

export class XAudioEncoder {
    get encodeQueueSize() {
        console.error('unimplemented!');
    }

    get state() {
        return this._state;
    }

    constructor(init) {
        const { output, error } = init;
        if(!output) {
            throw `Failed to construct 'AudioEncoder': Failed to read the 'output' property from 'AudioEncoderInit'`;
        }
        if(!error) {
            throw `Failed to construct 'AudioEncoder': Failed to read the 'error' property from 'AudioEncoderInit'`;
        }
        this.aac_error = error;
        this._state = 'unconfigured';
        this._n = loadWasm('/aac.wasm')
            .then(wasmBinary => aac({
                instantiateWasm: (imports, successCallback) => {
                    imports.env.aac_write_polyfill = (ptr, number) => {
                        output({
                            copyTo: (dest) => {
                                const l = dest.length;
                                for(let i = 0; i < l; i++) {
                                    dest[i] = this._m.HEAPU8[ptr + i];
                                }
                            },
                            byteLength: number,
                        }, {
                            decoderConfig: {
                                codec: 'mp4a.40.2',
                                sampleRate: this._sampleRate,
                                numberOfChannels: this._numberOfChannels,
                            }
                        });
                    };
                    WebAssembly.instantiate(new Uint8Array(wasmBinary), imports)
                        .then(function(output) {
                            successCallback(output.instance);
                        });
                }
            })).then(module => {
                this._m = module;
                this.encoder = new this._m.AACEncoder();
            })
    }

    configure(config) {
        this._state = 'configured';
        this._sampleRate = config.sampleRate;
        this._numberOfChannels = config.numberOfChannels;
        this._bitrate = config.bitrate;
        return this._n.then(() => {
            const r = this.encoder.configure(this._sampleRate, this._numberOfChannels, this._bitrate);
        });
    }

    encode(data) {
        if(this._state === 'unconfigured') {
            throw `Failed to execute 'encode' on 'AudioEncoder': Cannot call 'encode' on an unconfigured codec.`
        }
        const buf = data.data;
        const byteLength = buf.byteLength;
        const bufPtr = this._m._malloc(byteLength);
        this._m.HEAP16.set(buf, bufPtr);
        const r = this.encoder.encode(bufPtr * 2, byteLength);
        this._m._free(bufPtr);
    }

    flush() {
        this.encoder.flush();
    }

    close() {
        this._state = 'closed';
        // this.encoder.close();
    }
}

export class XAudioData {
    constructor(init) {
        const { format, sampleRate, numberOfFrames, numberOfChannels, timestamp, data } = init;
        this.data = data;
    }

    close() {}
}