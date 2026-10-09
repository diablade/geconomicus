import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Timer from '../src/misc/Timer.js';

const DU_INTERVAL = 3;

const makeTimer = (duCallback) =>
	new Timer('t1', {}, 60000, null, null, null, null, null, 10000, duCallback, null, null);

describe('Timer interval phase across pause/resume', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it('resumes the DU mid-cycle instead of restarting its countdown', async () => {
		const du = jest.fn();
		const timer = makeTimer(du);
		timer.start();

		jest.advanceTimersByTime(7000);
		expect(timer.getRemainingIntervalMs(DU_INTERVAL)).toBe(3000);
		timer.pause();

		const resumed = makeTimer(du);
		resumed.setFirstDelay(DU_INTERVAL, timer.getRemainingIntervalMs(DU_INTERVAL));
		resumed.start();

		await jest.advanceTimersByTimeAsync(2999);
		expect(du).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(1);
		expect(du).toHaveBeenCalledTimes(1);

		await jest.advanceTimersByTimeAsync(10000);
		expect(du).toHaveBeenCalledTimes(2);
		resumed.stop();
	});

	it('uses the full interval on a fresh start', () => {
		const du = jest.fn();
		const timer = makeTimer(du);
		timer.start();
		jest.advanceTimersByTime(9999);
		expect(du).not.toHaveBeenCalled();
		jest.advanceTimersByTime(1);
		expect(du).toHaveBeenCalledTimes(1);
		timer.stop();
	});
});
