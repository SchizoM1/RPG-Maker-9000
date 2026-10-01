//=============================================================================
// rpg9k_audio.js — WebAudio with HTMLAudioElement fallback, and Video.
// Under http(s) sounds are decoded with the Web Audio API (pitch, pan, loop
// points). Under file:// fetch is blocked, so an <audio> element is used.
//=============================================================================
"use strict";

var WebAudio = class {
    constructor(...args) {
        this.initialize(...args);
    }

    static initialize() {
        this._context = null;
        this._masterGainNode = null;
        this._masterVolume = 1;
        if (Utils.canUseWebAudioAPI() && !Utils.isLocal()) {
            try {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                this._context = new Ctx();
                this._masterGainNode = this._context.createGain();
                this._masterGainNode.connect(this._context.destination);
            } catch (e) {
                this._context = null;
            }
        }
        this._setupEventHandlers();
        return true;
    }

    static setMasterVolume(value) {
        this._masterVolume = value;
        if (this._masterGainNode) {
            const now = this._context.currentTime;
            this._masterGainNode.gain.setValueAtTime(value, now);
        }
        for (const audio of WebAudio._html5Instances) audio._updateHtml5Volume();
    }

    static _setupEventHandlers() {
        const resume = () => {
            const ctx = this._context;
            if (ctx && ctx.state === "suspended") ctx.resume();
        };
        document.addEventListener("keydown", resume);
        document.addEventListener("mousedown", resume);
        document.addEventListener("touchend", resume);
        document.addEventListener("visibilitychange", () => {
            const ctx = this._context;
            if (!ctx) return;
            if (document.visibilityState === "hidden") ctx.suspend();
            else ctx.resume();
        });
    }

    initialize(url) {
        this._url = url;
        this._buffer = null;
        this._sourceNode = null;
        this._gainNode = null;
        this._pannerNode = null;
        this._html5 = null;
        this._totalTime = 0;
        this._sampleRate = 0;
        this._loop = false;
        this._loopStart = 0;
        this._loopLength = 0;
        this._startTime = 0;
        this._volume = 1;
        this._pitch = 1;
        this._pan = 0;
        this._endTimer = null;
        this._loadListeners = [];
        this._stopListeners = [];
        this._loadingState = "loading";
        this._isPlaying = false;
        this._playRequest = null;
        this._startLoading();
    }

    get url() {
        return this._url;
    }

    get volume() {
        return this._volume;
    }
    set volume(value) {
        this._volume = value;
        if (this._gainNode) this._gainNode.gain.setValueAtTime(value, WebAudio._context.currentTime);
        this._updateHtml5Volume();
    }

    get pitch() {
        return this._pitch;
    }
    set pitch(value) {
        if (this._pitch !== value) {
            this._pitch = value;
            if (this.isPlaying()) this.play(this._loop, this.seek());
        }
    }

    get pan() {
        return this._pan;
    }
    set pan(value) {
        this._pan = value;
        if (this._pannerNode && this._pannerNode.pan) this._pannerNode.pan.value = value;
    }

    clear() {
        this.stop();
        this._buffer = null;
        this._totalTime = 0;
    }

    isReady() {
        return this._loadingState === "loaded";
    }

    isError() {
        return this._loadingState === "error";
    }

    isPlaying() {
        return this._isPlaying;
    }

    play(loop, offset) {
        this._loop = !!loop;
        offset = offset || 0;
        if (!this.isReady()) {
            this._playRequest = { loop: this._loop, offset };
            this._isPlaying = true;
            return;
        }
        this._isPlaying = true;
        if (this._html5) {
            this._playHtml5(offset);
        } else {
            this._startPlaying(offset);
        }
    }

    stop() {
        const wasPlaying = this._isPlaying;
        this._isPlaying = false;
        this._playRequest = null;
        this._removeEndTimer();
        this._removeNodes();
        if (this._html5) {
            this._html5.pause();
            this._clearHtml5Fade();
        }
        if (wasPlaying) this._callStopListeners();
    }

    destroy() {
        this.stop();
        this._buffer = null;
        if (this._html5) {
            WebAudio._html5Instances.delete(this);
            this._html5.src = "";
            this._html5 = null;
        }
    }

    fadeIn(duration) {
        if (this._html5) return this._html5Fade(0, 1, duration);
        if (this.isReady() && this._gainNode) {
            const gain = this._gainNode.gain;
            const currentTime = WebAudio._context.currentTime;
            gain.setValueAtTime(0, currentTime);
            gain.linearRampToValueAtTime(this._volume, currentTime + duration);
        } else {
            this._pendingFadeIn = duration;
        }
    }

    fadeOut(duration) {
        if (this._html5) return this._html5Fade(1, 0, duration);
        if (this._gainNode) {
            const gain = this._gainNode.gain;
            const currentTime = WebAudio._context.currentTime;
            gain.setValueAtTime(gain.value, currentTime);
            gain.linearRampToValueAtTime(0, currentTime + duration);
        }
        this._isPlaying = false;
        this._playRequest = null;
        this._callStopListeners();
    }

    seek() {
        if (this._html5) return this._html5.currentTime;
        if (WebAudio._context && this._sourceNode) {
            let pos = (WebAudio._context.currentTime - this._startTime) * this._pitch;
            if (this._loopLength > 0) {
                while (pos >= this._loopStart + this._loopLength) pos -= this._loopLength;
            } else if (this._totalTime > 0 && this._loop) {
                pos = pos % this._totalTime;
            }
            return pos;
        }
        return 0;
    }

    addLoadListener(listener) {
        if (this.isReady() || this.isError()) listener();
        else this._loadListeners.push(listener);
    }

    addStopListener(listener) {
        this._stopListeners.push(listener);
    }

    retry() {
        this._startLoading();
    }

    _startLoading() {
        this._loadingState = "loading";
        if (!WebAudio._context) {
            this._setupHtml5();
            return;
        }
        fetch(this._url)
            .then(response => {
                if (!response.ok) throw new Error("HTTP " + response.status);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                this._readLoopComments(new Uint8Array(arrayBuffer));
                return WebAudio._context.decodeAudioData(arrayBuffer);
            })
            .then(buffer => {
                this._buffer = buffer;
                this._totalTime = buffer.duration;
                this._sampleRate = buffer.sampleRate;
                if (this._loopLength > 0 && this._sampleRate > 0) {
                    this._loopStart /= this._sampleRate;
                    this._loopLength /= this._sampleRate;
                } else {
                    this._loopStart = 0;
                    this._loopLength = 0;
                }
                this._onLoad();
            })
            .catch(() => this._onLoadError());
    }

    _onLoad() {
        this._loadingState = "loaded";
        while (this._loadListeners.length > 0) this._loadListeners.shift()();
        if (this._playRequest) {
            const req = this._playRequest;
            this._playRequest = null;
            this.play(req.loop, req.offset);
            if (this._pendingFadeIn) {
                this.fadeIn(this._pendingFadeIn);
                this._pendingFadeIn = 0;
            }
        }
    }

    _onLoadError() {
        this._loadingState = "error";
        this._isPlaying = false;
        while (this._loadListeners.length > 0) this._loadListeners.shift()();
    }

    // Scans the file bytes for Vorbis/ID3 LOOPSTART / LOOPLENGTH comments.
    _readLoopComments(bytes) {
        const scanLimit = Math.min(bytes.length, 65536);
        let text = "";
        for (let i = 0; i < scanLimit; i++) {
            const c = bytes[i];
            text += c >= 32 && c < 127 ? String.fromCharCode(c) : " ";
        }
        const start = /LOOPSTART=([0-9]+)/.exec(text);
        const length = /LOOPLENGTH=([0-9]+)/.exec(text);
        if (start && length) {
            this._loopStart = Number(start[1]);
            this._loopLength = Number(length[1]);
        }
    }

    _startPlaying(offset) {
        if (this._loopLength > 0) {
            while (offset >= this._loopStart + this._loopLength) offset -= this._loopLength;
        }
        this._removeNodes();
        this._createNodes();
        this._connectNodes();
        this._sourceNode.start(0, offset);
        this._startTime = WebAudio._context.currentTime - offset / this._pitch;
        this._createEndTimer();
    }

    _createNodes() {
        const context = WebAudio._context;
        this._sourceNode = context.createBufferSource();
        this._sourceNode.buffer = this._buffer;
        this._sourceNode.loop = this._loop;
        if (this._loop && this._loopLength > 0) {
            this._sourceNode.loopStart = this._loopStart;
            this._sourceNode.loopEnd = this._loopStart + this._loopLength;
        }
        this._sourceNode.playbackRate.setValueAtTime(this._pitch, context.currentTime);
        this._gainNode = context.createGain();
        this._gainNode.gain.setValueAtTime(this._volume, context.currentTime);
        if (context.createStereoPanner) {
            this._pannerNode = context.createStereoPanner();
            this._pannerNode.pan.value = this._pan;
        } else {
            this._pannerNode = context.createGain();
        }
    }

    _connectNodes() {
        this._sourceNode.connect(this._gainNode);
        this._gainNode.connect(this._pannerNode);
        this._pannerNode.connect(WebAudio._masterGainNode);
    }

    _removeNodes() {
        if (this._sourceNode) {
            try {
                this._sourceNode.onended = null;
                this._sourceNode.stop();
            } catch (e) {
                // already stopped
            }
            this._sourceNode.disconnect();
            this._sourceNode = null;
        }
        if (this._gainNode) {
            this._gainNode.disconnect();
            this._gainNode = null;
        }
        if (this._pannerNode) {
            this._pannerNode.disconnect();
            this._pannerNode = null;
        }
    }

    _createEndTimer() {
        if (this._sourceNode && !this._loop) {
            this._sourceNode.onended = () => {
                if (this._isPlaying) {
                    this._isPlaying = false;
                    this._callStopListeners();
                }
            };
        }
    }

    _removeEndTimer() {
        if (this._sourceNode) this._sourceNode.onended = null;
    }

    _callStopListeners() {
        for (const listener of this._stopListeners.slice()) listener();
    }

    // HTML5 <audio> fallback
    _setupHtml5() {
        const audio = new Audio();
        this._html5 = audio;
        WebAudio._html5Instances.add(this);
        audio.preload = "auto";
        audio.addEventListener("canplaythrough", () => {
            if (this._loadingState === "loading") {
                this._totalTime = audio.duration;
                this._onLoad();
            }
        });
        audio.addEventListener("error", () => this._onLoadError());
        audio.addEventListener("ended", () => {
            if (!this._loop && this._isPlaying) {
                this._isPlaying = false;
                this._callStopListeners();
            }
        });
        audio.src = this._url;
        audio.load();
    }

    _playHtml5(offset) {
        const audio = this._html5;
        audio.loop = this._loop;
        audio.playbackRate = this._pitch;
        try {
            audio.currentTime = offset || 0;
        } catch (e) {
            // not seekable yet
        }
        this._html5FadeRate = 1;
        this._updateHtml5Volume();
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
    }

    _updateHtml5Volume() {
        if (this._html5) {
            const fade = this._html5FadeRate === undefined ? 1 : this._html5FadeRate;
            this._html5.volume = Math.max(0, Math.min(1, this._volume * WebAudio._masterVolume * fade));
        }
    }

    _html5Fade(from, to, duration) {
        this._clearHtml5Fade();
        const steps = Math.max(1, Math.round(duration * 20));
        let i = 0;
        this._html5FadeRate = from;
        this._updateHtml5Volume();
        this._html5FadeTimer = setInterval(() => {
            i++;
            this._html5FadeRate = from + ((to - from) * i) / steps;
            this._updateHtml5Volume();
            if (i >= steps) {
                this._clearHtml5Fade();
                if (to === 0) this.stop();
            }
        }, 50);
        if (to === 0) {
            this._isPlaying = false;
            this._callStopListeners();
        }
    }

    _clearHtml5Fade() {
        if (this._html5FadeTimer) {
            clearInterval(this._html5FadeTimer);
            this._html5FadeTimer = null;
        }
    }
};
WebAudio._html5Instances = new Set();
WebAudio._masterVolume = 1;

//-----------------------------------------------------------------------------
// Video — plays movie files over the canvas

var Video = {
    _element: null,
    _loading: false,
    _volume: 1,

    initialize(width, height) {
        this._element = document.createElement("video");
        this._element.id = "gameVideo";
        this._element.style.position = "absolute";
        this._element.style.opacity = 0;
        this._element.style.zIndex = 2;
        this._element.setAttribute("playsinline", "");
        this._element.oncanplay = () => this._onLoad();
        this._element.onerror = () => this._onEnd();
        this._element.onended = () => this._onEnd();
        document.body.appendChild(this._element);
        this.resize(width, height);
    },
    resize(width, height) {
        if (!this._element) return;
        this._element.style.width = width + "px";
        this._element.style.height = height + "px";
    },
    play(src) {
        this._element.src = src;
        this._element.onloadeddata = () => this._onLoad();
        this._element.load();
        this._loading = true;
    },
    isPlaying() {
        return this._loading || (this._element && this._element.style.opacity > 0);
    },
    setVolume(volume) {
        this._volume = volume;
        if (this._element) this._element.volume = volume;
    },
    _onLoad() {
        if (!this._loading) return;
        this._loading = false;
        const canvas = Graphics._canvas;
        if (canvas) {
            this._element.style.left = canvas.style.left;
            this._element.style.top = canvas.style.top;
            this._element.style.width = canvas.style.width;
            this._element.style.height = canvas.style.height;
        }
        this._element.volume = this._volume;
        this._element.style.opacity = 1;
        const p = this._element.play();
        if (p && p.catch) p.catch(() => this._onEnd());
    },
    _onEnd() {
        this._loading = false;
        if (this._element) this._element.style.opacity = 0;
    }
};
