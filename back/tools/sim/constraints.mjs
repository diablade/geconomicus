/**
 * Pass/fail thresholds, scaled to table size where it matters.
 *
 * latentFloor and strandedCeiling are working guesses, not measured values — they
 * encode a hunch about how much reachable opportunity a table needs to feel alive,
 * and should be re-based once enough real games have been observed.
 *
 * @param {number} players
 * @returns {{latentFloor: number, strandedCeiling: number, deadlockGraceRounds: number,
 *            temperatureTolerance: number, techShiftFloorRound: number}}
 */
export function defaultThresholds(players) {
	return {
		latentFloor: Math.max(1, Math.ceil(players / 2)),
		strandedCeiling: 0.5,
		deadlockGraceRounds: 0,
		temperatureTolerance: 2,
		techShiftFloorRound: 25,
	};
}

/**
 * Check that the technological shift happened, and not too early.
 *
 * Used only when the mechanic is switched on. A shift that never arrives fails
 * just as a premature one does: the point is a late-game climax, not an absence.
 *
 * An absence is reported with the highest level any production reached, because the
 * two ways to miss the shift look identical otherwise — a table that ran out of rounds
 * on its way up, and a table that stalled several levels below the trigger.
 *
 * @param {object} result - a completed run
 * @param {{techShiftFloorRound: number}} thresholds
 * @returns {object} a check descriptor carrying both plain-text and i18n-key forms
 */
function techShiftCheck(result, thresholds) {
	const shifts = result.techShifts ?? [];
	const floor = thresholds.techShiftFloorRound;

	if (!shifts.length) {
		const reached = result.highestWeightProduced ?? 0;
		const trigger = result.topWeight;
		return {
			id: 'tech-shift-timing',
			label: `Technological shift arrived at round ${floor} or later`,
			labelKey: 'TOOLS.CHECK.TECH_SHIFT_TIMING',
			labelParams: { floor },
			passed: false,
			detail: `never happened — best production reached level ${reached}, the shift needs level ${trigger}`,
			detailKey: 'TOOLS.CHECK.TECH_SHIFT_NEVER',
			detailParams: { reached, trigger },
		};
	}

	const first = shifts[0];
	return {
		id: 'tech-shift-timing',
		label: `Technological shift arrived at round ${floor} or later`,
		labelKey: 'TOOLS.CHECK.TECH_SHIFT_TIMING',
		labelParams: { floor },
		passed: first.round >= floor,
		detail: `${shifts.length} shift(s), first at round ${first.round}`,
		detailKey: first.round >= floor ? 'TOOLS.CHECK.TECH_SHIFT_TIMING_OK' : 'TOOLS.CHECK.TECH_SHIFT_TIMING_EARLY',
		detailParams: { count: shifts.length, round: first.round, level: first.topWeight },
	};
}

/**
 * Check that play never reached the unimplemented level-3 ceiling.
 *
 * The counterpart to {@link techShiftCheck}, used when the mechanic is switched
 * off — which is how the shipped game behaves today.
 *
 * @param {object} result - a completed run
 * @returns {object} a check descriptor carrying both plain-text and i18n-key forms
 */
function techWallCheck(result) {
	return {
		id: 'no-tech-wall',
		label: 'Never hit the unimplemented technological shift',
		labelKey: 'TOOLS.CHECK.NO_TECH_WALL',
		passed: result.techShiftReached === 0,
		detail:
			result.techShiftReached === 0
				? 'weight 3 never reached'
				: `reached at round ${result.techShiftRound} (${result.techShiftReached} time(s))`,
		detailKey: result.techShiftReached === 0 ? 'TOOLS.CHECK.NO_TECH_WALL_OK' : 'TOOLS.CHECK.NO_TECH_WALL_FAIL',
		detailParams:
			result.techShiftReached === 0 ? {} : { round: result.techShiftRound, count: result.techShiftReached },
	};
}

/**
 * Score a completed run against every constraint.
 *
 * Each check carries a plain-English label for the CLI and a translation key with
 * params for the web page, so both surfaces report identical verdicts.
 *
 * @param {object} result - the value returned by runGame
 * @param {object} [thresholdOverrides] - caller overrides merged over the defaults
 * @returns {{thresholds: object, checks: Array<object>, passed: boolean, failedCount: number}}
 */
export function evaluate(result, thresholdOverrides = {}) {
	const players = result.config.players;
	const thresholds = { ...defaultThresholds(players), ...thresholdOverrides };
	const samples = result.samples ?? [];

	const latentValues = samples.map((s) => s.latentSquares);
	const strandedValues = samples.map((s) => s.strandedShare);
	const deadRounds = samples.filter((s) => s.latentSquares === 0).length;
	const minLatent = latentValues.length ? Math.min(...latentValues) : 0;
	const peakStranded = strandedValues.length ? Math.max(...strandedValues) : 0;
	const silentAvatars = result.productionsPerAvatar.filter((n) => n === 0).length;

	const checks = [
		{
			id: 'no-hard-throw',
			label: 'No production threw',
			labelKey: 'TOOLS.CHECK.NO_HARD_THROW',
			passed: result.hardThrows.length === 0,
			detail: result.hardThrows.length
				? `${result.hardThrows.length} throw(s), first: ${result.hardThrows[0].message} at round ${result.hardThrows[0].round}`
				: 'no ERROR.NOT_ENOUGH_CARDS_IN_DECK',
			detailKey: result.hardThrows.length ? 'TOOLS.CHECK.NO_HARD_THROW_FAIL' : 'TOOLS.CHECK.NO_HARD_THROW_OK',
			detailParams: result.hardThrows.length
				? { count: result.hardThrows.length, round: result.hardThrows[0].round, message: result.hardThrows[0].message }
				: {},
		},
		result.config.rules.techShiftEnabled ? techShiftCheck(result, thresholds) : techWallCheck(result),
		{
			id: 'no-deadlock',
			label: 'A latent square always existed',
			labelKey: 'TOOLS.CHECK.NO_DEADLOCK',
			passed: deadRounds <= thresholds.deadlockGraceRounds,
			detail: deadRounds ? `${deadRounds} round(s) with zero latent squares` : 'never zero',
			detailKey: deadRounds ? 'TOOLS.CHECK.NO_DEADLOCK_FAIL' : 'TOOLS.CHECK.NO_DEADLOCK_OK',
			detailParams: { count: deadRounds },
		},
		{
			id: 'everyone-produced',
			label: 'Every avatar produced at least once',
			labelKey: 'TOOLS.CHECK.EVERYONE_PRODUCED',
			passed: result.everyoneProduced,
			detail: result.everyoneProduced
				? `worst avatar built ${result.minProductions}`
				: `${silentAvatars} avatar(s) never produced`,
			detailKey: result.everyoneProduced
				? 'TOOLS.CHECK.EVERYONE_PRODUCED_OK'
				: 'TOOLS.CHECK.EVERYONE_PRODUCED_FAIL',
			detailParams: result.everyoneProduced ? { count: result.minProductions } : { count: silentAvatars },
		},
		{
			id: 'latent-floor',
			label: `Latent squares stayed above ${thresholds.latentFloor}`,
			labelKey: 'TOOLS.CHECK.LATENT_FLOOR',
			labelParams: { floor: thresholds.latentFloor },
			passed: latentValues.length > 0 && minLatent >= thresholds.latentFloor,
			detail: latentValues.length ? `minimum was ${minLatent}` : 'no samples',
			detailKey: 'TOOLS.CHECK.LATENT_FLOOR_DETAIL',
			detailParams: { min: minLatent },
		},
		{
			id: 'stranded-ceiling',
			label: `Stranded share stayed under ${(thresholds.strandedCeiling * 100).toFixed(0)}%`,
			labelKey: 'TOOLS.CHECK.STRANDED_CEILING',
			labelParams: { ceiling: (thresholds.strandedCeiling * 100).toFixed(0) },
			passed: strandedValues.length > 0 && peakStranded <= thresholds.strandedCeiling,
			detail: strandedValues.length ? `peaked at ${(peakStranded * 100).toFixed(1)}%` : 'no samples',
			detailKey: 'TOOLS.CHECK.STRANDED_CEILING_DETAIL',
			detailParams: { peak: (peakStranded * 100).toFixed(1) },
		},
		{
			id: 'temperature',
			label: `Tempo within ×${thresholds.temperatureTolerance} of the baseline`,
			labelKey: 'TOOLS.CHECK.TEMPERATURE',
			labelParams: { tolerance: thresholds.temperatureTolerance },
			passed:
				result.temperature.ratio >= 1 / thresholds.temperatureTolerance &&
				result.temperature.ratio <= thresholds.temperatureTolerance,
			detail: `×${result.temperature.ratio.toFixed(2)} (${result.temperature.band})`,
			detailKey: 'TOOLS.CHECK.TEMPERATURE_DETAIL',
			detailParams: { ratio: result.temperature.ratio.toFixed(2), band: result.temperature.band },
		},
	];

	return {
		thresholds,
		checks,
		passed: checks.every((c) => c.passed),
		failedCount: checks.filter((c) => !c.passed).length,
	};
}
