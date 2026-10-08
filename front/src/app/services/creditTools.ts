export const CREDIT_FINAL_SECONDS = 60;

export interface CreditCountdown {
	label: string;
	progress: number;
	color: string;
	finalMinute: boolean;
}

export function creditProgressColor(progress: number): string {
	if (progress < 50) {
		return '#28a745';
	} else if (progress < 75) {
		return '#ffc107';
	} else {
		return '#dc3545';
	}
}

const twoDigits = (value: number): string => String(value).padStart(2, '0');

export function creditCountdownAt(endsAt: number, durationMs: number, now: number): CreditCountdown | null {
	const remainingMs = endsAt - now;
	if (remainingMs <= 0 || durationMs <= 0) return null;

	const progress = Math.min(100, ((durationMs - remainingMs) / durationMs) * 100);
	const totalSeconds = Math.ceil(remainingMs / 1000);
	const finalMinute = totalSeconds <= CREDIT_FINAL_SECONDS;

	return {
		label: finalMinute
			? twoDigits(totalSeconds)
			: `${twoDigits(Math.floor(totalSeconds / 60))}:${twoDigits(totalSeconds % 60)}`,
		progress,
		color: creditProgressColor(progress),
		finalMinute,
	};
}
