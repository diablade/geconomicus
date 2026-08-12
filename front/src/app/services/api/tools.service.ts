import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SimRules {
	amountCardsForProd: number;
	generatedIdenticalLetters: number;
	generateLettersAuto: boolean;
	generateLettersInDeck?: number;
	distribInitCards: number;
	autoDeath: boolean;
	inequalityStart: boolean;
	startAmountCoins: number;
	tauxCroissance: number;
	timerDUInterval: number;
	durationCredit: number;
	timerPrison: number;
	defaultCreditAmount: number;
	defaultInterestAmount: number;
	priceWeight1: number;
	priceWeight2: number;
	priceWeight3: number;
	priceWeight4: number;
	autoBank: boolean;
	autoSeizure: boolean;
	firstCreditAcceptance: number;
	seizureType: string;
	seizureDecote: number;
	seizureCosts: number;
	techShiftEnabled: boolean;
	techShiftExchangeRatio: number;
}

export interface SimThresholds {
	latentFloor?: number;
	strandedCeiling?: number;
	deadlockGraceRounds?: number;
	temperatureTolerance?: number;
	techShiftFloorRound?: number;
}

export interface SimTemperature {
	ratio: number;
	perPlayerRound: number;
	band: string;
}

export interface SimRequest {
	players: number;
	typeMoney: string;
	seed: number;
	rounds: number;
	encountersPerRound: number;
	animatorCreditsPerRound: number;
	logActions: boolean;
	rules: SimRules;
	thresholds: SimThresholds;
}

export interface SimLogEntry {
	round: number;
	playerIdx: number;
	avatarIdx: number;
	type: string;
	free: boolean;
	detail?: string;
	counterparty?: number;
	coins?: number;
	handSize?: number;
	reason?: string;
	reasonPrice?: number;
}

export interface SimEvent {
	typeEvent: string;
	sessionId: string;
	gameStateId: string;
	emitter: number | string;
	receiver: number | string;
	payload: { [key: string]: unknown };
	at: number;
}

export interface SimSample {
	round: number;
	latentSquares: number;
	readySquares: number;
	theoreticalSquares: number;
	strandedShare: number;
	deckSizes: number[];
	massMonetary: number;
	aliveCount: number;
}

export interface SimResult {
	config: { players: number; typeMoney: string; rounds: number; seed: number; rules: SimRules };
	transactions: number;
	productions: number;
	searches: number;
	searchReasons: Record<string, number>;
	techShifts: {
		round: number;
		topWeight: number;
		ladder: number[];
		retiredPlayers?: number;
		retiredCards?: number;
		replacementCards?: number;
	}[];
	retirements: number;
	priceLadder: number[];
	topWeight: number;
	utilisation: number;
	transactionsPerProduction: number | null;
	productionsPerAvatar: number[];
	minProductions: number;
	everyoneProduced: boolean;
	giniProductions: number;
	deaths: number;
	rebirths: number;
	ghostMoney: number;
	temperature: SimTemperature;
	referenceProductionsPerPlayerRound: number;
	firstQuestionCredits: number;
	seizuresDelayed: number;
	creditsCreated: number;
	creditsExtended: number;
	creditsSettled: number;
	faults: number;
	seizures: number;
	prisonSentences: number;
	interestPaid: number;
	techShiftReached: number;
	techShiftRound: number | null;
	highestWeightProduced: number;
	events: SimEvent[];
	hardThrows: { round: number; playerIdx: number; message: string }[];
	finalMass: number;
	finalDU: number;
	aliveAtEnd: number;
	samples: SimSample[];
	log: SimLogEntry[];
	logTruncated: boolean;
}

export interface SimCheck {
	id: string;
	label: string;
	labelKey: string;
	labelParams?: { [key: string]: string | number };
	passed: boolean;
	detail: string;
	detailKey: string;
	detailParams?: { [key: string]: string | number };
}

export interface SimVerdict {
	thresholds: Required<SimThresholds>;
	checks: SimCheck[];
	passed: boolean;
	failedCount: number;
}

export interface SimResponse {
	result: SimResult;
	verdict: SimVerdict;
	elapsedMs: number;
}

@Injectable({ providedIn: 'root' })
export class ToolsService {
	constructor(private http: HttpClient) {}

	simulate(request: SimRequest): Observable<SimResponse> {
		return this.http.post<SimResponse>(environment.API_HOST + environment.TOOLS.SIMULATE, request);
	}
}
