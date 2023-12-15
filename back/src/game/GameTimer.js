import {addMilliseconds} from 'date-fns';

export default class GameTimer {
    constructor(id, duration, intervalDuration, data, callbackAtInterval, callbackAtEnd) {
        this.id = id;
        this.duration = duration;
        this.interval = intervalDuration;
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
        this.timer = setTimeout(() => {
            this.callbackAtEnd(this);
            this.start(); // Restart the timer
        }, this.duration);

        // Start the heartbeat
        this.heartbeat = setInterval(() => {
            this.callbackAtInterval(this);
        }, this.interval); // Every minute
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
