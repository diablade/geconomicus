import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { GAME_TYPE } from '@geco/shared';
import { EventService } from '../services/api/event.service';
import { SurveyService, SurveyAnswer } from '../services/api/survey.service';
import { SessionResultsService, GameResults, PlayerRef } from '../services/session-results.service';
import { EventFilter, GecoEventV2 } from '../models/geco-event';
// TODO(front): SessionService (or equivalent) to fetch the session + its two
// gameStates + players; adjust import to the real service name in v2.
// import { SessionService } from '../services/api/session.service';

/**
 * ─── SessionResultsCompareComponent ─────────────────────────────────────────
 * Route:  results-compare/:sessionId   (design "2a" — face à face)
 * Layout: header · collapsible events sidebar (left) · synthesis table ·
 *         podiums · actions (good|bad) · collapsible Comptes / Ressources /
 *         Sondage sections, dette column left, libre column right.
 * All filtering is client-side on the raw event stream.
 */
@Component({
	selector: 'app-session-results-compare',
	templateUrl: './session-results-compare.component.html',
	styleUrls: ['./session-results-compare.component.scss'],
})
export class SessionResultsCompareComponent implements OnInit {
	sessionId!: string;
	sessionName = '';
	location = '';

	// raw data
	events: GecoEventV2[] = [];
	answers: SurveyAnswer[] = [];

	// per game
	dette?: GameResults;
	libre?: GameResults;
	detteGsId = '';
	libreGsId = '';
	players: PlayerRef[] = [];

	// UI state
	showEvents = false;
	sections = { accounts: false, resources: false, feelings: false };
	legends: { [chart: string]: boolean } = {};
	openTip: string | null = null;

	// le filtrage vit dans EventsV2Component ; le parent est juste notifié
	onEventsFilter(_f: EventFilter): void {
		// hook optionnel : surligner les joueurs filtrés sur les graphes, etc.
	}

	constructor(
		private route: ActivatedRoute,
		private eventService: EventService,
		private surveyService: SurveyService,
		private results: SessionResultsService
		// private sessionService: SessionService,
	) {}

	ngOnInit(): void {
		this.sessionId = this.route.snapshot.params['sessionId'];
		// TODO(front): fetch session meta first to know both gameStateIds,
		// typeMoney of each, players (name+color+playerStateIdx), startAmountCoins,
		// firstDU. Pseudocode below assumes sessionService.getById returns it.
		forkJoin({
			events: this.eventService.getBySessionId(this.sessionId),
			answers: this.surveyService.getBySessionId(this.sessionId),
			// session: this.sessionService.getById(this.sessionId),
		}).subscribe(({ events, answers }) => {
			this.events = events;
			this.answers = answers;
			// TODO(front): from session meta —
			// this.detteGsId  = session.games.find(g => g.typeMoney === GAME_TYPE.DEBT)._id;
			// this.libreGsId  = session.games.find(g => g.typeMoney === GAME_TYPE.JUNE)._id;
			// this.players    = session.players.map(p => ({idx: String(p.playerStateIdx), name: p.name, color: p.color}));
			this.computeAll();
		});
	}

	private computeAll(): void {
		// TODO(front): real startAmountCoins / firstDU from each gameState
		this.dette = this.results.compute(this.detteGsId, GAME_TYPE.DEBT, this.players, this.events, 3, 0);
		this.libre = this.results.compute(this.libreGsId, GAME_TYPE.JUNE, this.players, this.events, 5, 1);
		this.buildCharts();
	}

	toggleSection(k: keyof SessionResultsCompareComponent['sections']): void {
		this.sections[k] = !this.sections[k];
	}
	toggleLegend(chart: string): void {
		this.legends[chart] = !this.legends[chart];
	}
	toggleTip(id: string): void {
		this.openTip = this.openTip === id ? null : id;
	}

	/* ── charts (Chart.js, same lib as v1 results) ──
	 * One chart per card, NO cross-game overlay (facts only, per review).
	 * datasets come straight from GameResults series — LK points, no rebuild.
	 * TODO(front): reuse v1 results.component chart options (time axis,
	 * stepped:false, pointRadius:0) and add the mass-monetary dashed line.
	 */
	private buildCharts(): void {
		// this.chartDetteAbs  = { datasets: this.dette.coins.map(toDataset) ... }
		// this.chartLibreAbs  = { datasets: this.libre.coins.map(toDataset) ... }
		// this.chartLibreRel  = { datasets: this.libre.coinsRelative.map(toDataset) }
		// this.chartDetteRes / chartLibreRes / feelings radar per game
	}
}
