import {addMilliseconds} from 'date-fns';

export default class Timer {
    /**
     *
     * @param uniqueId of timer
     * @param duration in milliseconds
     * @param interval in millisecinds
     * @param data (payload)
     * @param callbackAtInterval
     * @param callbackAtEnd
     */
    constructor(uniqueId, duration, interval, data, callbackAtInterval, callbackAtEnd) {
        this.id = uniqueId;
        this.duration = duration; // in milliseconds
        this.interval = interval;
        this.data = data;
        this.callbackAtInterval = callbackAtInterval;
        this.callbackAtEnd = callbackAtEnd;
        this.timer = null;
        this.heartbeat = null;
        this.endTime = null;
        this.startTime = null;
    }

    start() {
        this.endTime = addMilliseconds(new Date(), this.duration);
        this.startTime = new Date();

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
        }
        if (this.heartbeat) {
            clearInterval(this.heartbeat);
        }
        // this.id = null;
        this.duration = null
        this.interval = null;
        this.data = null;
        this.callbackAtInterval = null;
        this.callbackAtEnd = null;
        this.timer = null;
        this.heartbeat = null;
        this.endTime = null;
        this.startTime = null;
    }
}
