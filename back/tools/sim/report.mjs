const PALETTE = ['#4c8dff', '#f2994a', '#27ae60', '#eb5757', '#9b51e0', '#00b8d4', '#e0b400', '#ff6ec7'];

const escapeHtml = (s) =>
	String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function lineChart({ series, width = 720, height = 260, yMin = 0, yMax, xLabel = 'round', stepped = false }) {
	const pad = { top: 16, right: 16, bottom: 34, left: 48 };
	const plotW = width - pad.left - pad.right;
	const plotH = height - pad.top - pad.bottom;

	const allX = series.flatMap((s) => s.points.map((p) => p.x));
	const allY = series.flatMap((s) => s.points.map((p) => p.y));
	if (!allX.length) return '<p class="empty">no data</p>';

	const xMin = Math.min(...allX);
	const xMax = Math.max(...allX);
	const top = yMax ?? Math.max(1, Math.max(...allY));
	const bottom = yMin;

	const sx = (x) => pad.left + ((x - xMin) / Math.max(1, xMax - xMin)) * plotW;
	const sy = (y) => pad.top + plotH - ((y - bottom) / Math.max(1e-9, top - bottom)) * plotH;

	const ticks = 4;
	const gridlines = Array.from({ length: ticks + 1 }, (_, i) => {
		const value = bottom + ((top - bottom) * i) / ticks;
		const y = sy(value);
		const label = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(Math.abs(value) < 10 ? 1 : 0);
		return `<line class="grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>
			<text class="tick" x="${pad.left - 8}" y="${y + 4}" text-anchor="end">${label}</text>`;
	}).join('');

	const paths = series
		.map((s, i) => {
			const colour = s.colour ?? PALETTE[i % PALETTE.length];
			if (!s.points.length) return '';
			let d = '';
			s.points.forEach((p, idx) => {
				const x = sx(p.x);
				const y = sy(p.y);
				if (idx === 0) d += `M ${x} ${y}`;
				else if (stepped) d += ` L ${x} ${sy(s.points[idx - 1].y)} L ${x} ${y}`;
				else d += ` L ${x} ${y}`;
			});
			return `<path class="series" d="${d}" stroke="${colour}"/>`;
		})
		.join('');

	const legend = series
		.map((s, i) => {
			const colour = s.colour ?? PALETTE[i % PALETTE.length];
			return `<span class="key"><i style="background:${colour}"></i>${escapeHtml(s.label)}</span>`;
		})
		.join('');

	return `<div class="chart">
		<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
			${gridlines}
			<line class="axis" x1="${pad.left}" y1="${pad.top + plotH}" x2="${width - pad.right}" y2="${pad.top + plotH}"/>
			${paths}
			<text class="tick" x="${pad.left}" y="${height - 8}">${xMin}</text>
			<text class="tick" x="${width - pad.right}" y="${height - 8}" text-anchor="end">${xMax} ${escapeHtml(xLabel)}</text>
		</svg>
		<div class="legend">${legend}</div>
	</div>`;
}

function barChart({ values, labels, width = 720, height = 220, highlightMin = true }) {
	const pad = { top: 16, right: 16, bottom: 30, left: 48 };
	const plotW = width - pad.left - pad.right;
	const plotH = height - pad.top - pad.bottom;
	const top = Math.max(1, ...values);
	const slot = plotW / values.length;
	const minValue = Math.min(...values);

	const bars = values
		.map((v, i) => {
			const h = (v / top) * plotH;
			const x = pad.left + i * slot + slot * 0.15;
			const w = slot * 0.7;
			const y = pad.top + plotH - h;
			const isWorst = highlightMin && v === minValue;
			return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${isWorst ? '#eb5757' : '#4c8dff'}"/>
				<text class="tick" x="${x + w / 2}" y="${pad.top + plotH + 14}" text-anchor="middle">${escapeHtml(labels[i])}</text>
				<text class="tick" x="${x + w / 2}" y="${y - 4}" text-anchor="middle">${v}</text>`;
		})
		.join('');

	return `<div class="chart"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
		<line class="axis" x1="${pad.left}" y1="${pad.top + plotH}" x2="${width - pad.right}" y2="${pad.top + plotH}"/>
		${bars}
	</svg></div>`;
}

function metricCard(label, value, note = '') {
	return `<div class="metric"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span>${
		note ? `<span class="note">${escapeHtml(note)}</span>` : ''
	}</div>`;
}

export function renderReport(result, verdict) {
	const samples = result.samples ?? [];
	const rounds = samples.map((s) => s.round);
	const cfg = result.config;
	const rules = cfg.rules;
	const isJune = cfg.typeMoney === 'june';

	const deckSeries = [0, 1, 2, 3].map((level) => ({
		label: `deck level ${level}`,
		points: samples.map((s) => ({ x: s.round, y: s.deckSizes[level] ?? 0 })),
	}));

	const squareSeries = [
		{ label: 'Theoretical', points: samples.map((s) => ({ x: s.round, y: s.theoreticalSquares })), colour: '#9b51e0' },
		{ label: 'Latent', points: samples.map((s) => ({ x: s.round, y: s.latentSquares })), colour: '#27ae60' },
		{ label: 'Ready', points: samples.map((s) => ({ x: s.round, y: s.readySquares })), colour: '#f2994a' },
	];

	const strandedSeries = [
		{
			label: 'stranded share of held cards',
			points: samples.map((s) => ({ x: s.round, y: s.strandedShare * 100 })),
			colour: '#eb5757',
		},
	];

	const moneySeries = [
		{ label: 'money mass', points: samples.map((s) => ({ x: s.round, y: s.massMonetary })), colour: '#4c8dff' },
	];

	const checksHtml = verdict.checks
		.map(
			(c) => `<li class="${c.passed ? 'pass' : 'fail'}">
				<span class="badge">${c.passed ? 'PASS' : 'FAIL'}</span>
				<span class="check-label">${escapeHtml(c.label)}</span>
				<span class="check-detail">${escapeHtml(c.detail)}</span>
			</li>`
		)
		.join('');

	const shape = `${rules.amountCardsForProd}-of-${rules.generatedIdenticalLetters}`;
	const shapeName = { 3: 'triangle', 4: 'square', 5: 'quinte' }[rules.amountCardsForProd] ?? 'custom';

	return `<title>Geconomicus deck simulation — ${cfg.players} players, ${cfg.typeMoney}</title>
<style>
	:root { color-scheme: light dark; --bg:#ffffff; --fg:#16181d; --muted:#5f6672; --card:#f5f7fa; --line:#dfe3e9; --grid:#eceff3; }
	@media (prefers-color-scheme: dark) { :root { --bg:#12141a; --fg:#e8eaf0; --muted:#9aa3b2; --card:#1b1e26; --line:#2c313c; --grid:#232733; } }
	:root[data-theme="dark"] { --bg:#12141a; --fg:#e8eaf0; --muted:#9aa3b2; --card:#1b1e26; --line:#2c313c; --grid:#232733; }
	:root[data-theme="light"] { --bg:#ffffff; --fg:#16181d; --muted:#5f6672; --card:#f5f7fa; --line:#dfe3e9; --grid:#eceff3; }
	body { background:var(--bg); color:var(--fg); font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; margin:0; padding:32px 20px 64px; }
	.wrap { max-width:860px; margin:0 auto; }
	h1 { font-size:1.5rem; margin:0 0 4px; }
	h2 { font-size:1.05rem; margin:36px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--line); }
	.sub { color:var(--muted); margin:0 0 24px; }
	.verdict { padding:14px 18px; border-radius:10px; font-weight:600; margin-bottom:18px; }
	.verdict.ok { background:rgba(39,174,96,.14); color:#27ae60; }
	.verdict.no { background:rgba(235,87,87,.14); color:#eb5757; }
	ul.checks { list-style:none; padding:0; margin:0; }
	ul.checks li { display:grid; grid-template-columns:56px 1fr; gap:4px 12px; padding:10px 0; border-bottom:1px solid var(--line); }
	.badge { font-size:.7rem; font-weight:700; letter-spacing:.05em; padding:3px 0; text-align:center; border-radius:4px; height:fit-content; }
	li.pass .badge { background:rgba(39,174,96,.16); color:#27ae60; }
	li.fail .badge { background:rgba(235,87,87,.16); color:#eb5757; }
	.check-detail { grid-column:2; color:var(--muted); font-size:.87rem; }
	.metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:10px; }
	.metric { background:var(--card); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:2px; }
	.metric .label { font-size:.76rem; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
	.metric .value { font-size:1.3rem; font-weight:650; }
	.metric .note { font-size:.78rem; color:var(--muted); }
	.chart { overflow-x:auto; margin:8px 0 4px; }
	.chart svg { width:100%; height:auto; display:block; }
	.grid { stroke:var(--grid); stroke-width:1; }
	.axis { stroke:var(--line); stroke-width:1; }
	.series { fill:none; stroke-width:2; }
	.tick { fill:var(--muted); font-size:11px; }
	.legend { display:flex; flex-wrap:wrap; gap:14px; font-size:.82rem; color:var(--muted); }
	.key { display:inline-flex; align-items:center; gap:6px; }
	.key i { width:11px; height:11px; border-radius:3px; display:inline-block; }
	table { width:100%; border-collapse:collapse; font-size:.88rem; }
	td, th { text-align:left; padding:7px 10px; border-bottom:1px solid var(--line); }
	th { color:var(--muted); font-weight:600; }
	.empty { color:var(--muted); font-style:italic; }
</style>
<div class="wrap">
	<h1>${cfg.players} players — ${escapeHtml(cfg.typeMoney)}</h1>
	<p class="sub">${cfg.rounds} rounds · ${shapeName} ${shape} · ${rules.generateLettersAuto ? 'auto letters' : `${rules.generateLettersInDeck} letters`} · seed ${cfg.seed}</p>

	<div class="verdict ${verdict.passed ? 'ok' : 'no'}">
		${verdict.passed ? 'All constraints passed' : `${verdict.failedCount} constraint(s) failed`}
	</div>
	<ul class="checks">${checksHtml}</ul>

	<h2>Headline</h2>
	<div class="metrics">
		${metricCard('Transactions', String(result.transactions))}
		${metricCard('Productions', String(result.productions))}
		${metricCard('Tx per production', result.transactionsPerProduction?.toFixed(2) ?? '—')}
		${metricCard('Utilisation', (result.utilisation * 100).toFixed(1) + '%', 'rounds that bought')}
		${metricCard('Worst avatar', String(result.minProductions), 'productions — the tie-break')}
		${metricCard('Gini (productions)', result.giniProductions.toFixed(2), 'information only')}
		${metricCard('Deaths / rebirths', `${result.deaths} / ${result.rebirths}`)}
		${metricCard('Ghost money', result.ghostMoney.toFixed(1))}
		${isJune ? metricCard('Final DU', String(result.finalDU)) : metricCard('Credits taken', String(result.creditsCreated))}
		${isJune ? metricCard('Final mass', result.finalMass.toFixed(0)) : metricCard('Faults / prison', `${result.faults} / ${result.prisonSentences}`)}
	</div>

	<h2>Squares over time</h2>
	<p class="sub">The gap between Theoretical and Latent is the doomed-chase zone — cards that look completable but whose remaining copies sit in a deck.</p>
	${lineChart({ series: squareSeries, stepped: true })}

	<h2>Stranded share</h2>
	<p class="sub">Share of cards in living hands belonging to a recipe that cannot be completed from living hands.</p>
	${lineChart({ series: strandedSeries, yMax: 100, stepped: true })}

	<h2>Decks draining</h2>
	<p class="sub">Production is net-zero on its own level and −1 on the level above, so upper decks drain monotonically.</p>
	${lineChart({ series: deckSeries, stepped: true })}

	<h2>Money mass</h2>
	${lineChart({ series: moneySeries, stepped: true })}

	<h2>Productions per avatar</h2>
	<p class="sub">Red is the worst avatar — the maximin tie-break optimises this bar.</p>
	${barChart({ values: result.productionsPerAvatar, labels: result.productionsPerAvatar.map((_, i) => String(i)) })}

	<h2>Configuration</h2>
	<table>
		<tr><th>players</th><td>${cfg.players}</td><th>rounds</th><td>${cfg.rounds}</td></tr>
		<tr><th>amountCardsForProd</th><td>${rules.amountCardsForProd}</td><th>generatedIdenticalLetters</th><td>${rules.generatedIdenticalLetters}</td></tr>
		<tr><th>distribInitCards</th><td>${rules.distribInitCards}</td><th>autoDeath</th><td>${rules.autoDeath}</td></tr>
		<tr><th>encountersPerRound</th><td>${cfg.encountersPerRound ?? '—'}</td><th>startAmountCoins</th><td>${rules.startAmountCoins}</td></tr>
		<tr><th>cards per level</th><td>${result.finalSample?.deckSizes ? '—' : '—'}</td><th>seed</th><td>${cfg.seed}</td></tr>
	</table>
</div>`;
}
