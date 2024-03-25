import {addMilliseconds} from 'date-fns';

export default class Timer {
    constructor(uniqueId, duration, interval, data, callbackAtInterval, callbackAtEnd) {
        this.id = uniqueId;
        this.duration = duration;
        this.interval = interval;
        this.data = data;
        this.callbackAtInterval = callbackAtInterval;
        this.callbackAtEnd = callbackAtEnd;
        this.timer = null;
        this.heartbeat = null;
        this.endTime = null;
    }

    start() {
        this.stop(); // Stop any existing timer
        this.endTime = addMilliseconds(new Date(), this.duration);

        // Start the timer
        this.timer = setTimeout(() => {
            this.callbackAtEnd(this);
            }, this.duration);

        // Start the heartbeat
        this.heartbeat = setInterval(() => {
            this.callbackAtInterval(this);
        }, this.interval); // Every interval
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
            this.heartbeat = null;
        }
    }
}
