import { Component, Input } from '@angular/core';
import * as _ from 'lodash-es';
import { Card, EventGeco, Player } from "../models/game";
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import Chart from 'chart.js/auto';
// @ts-ignore
import { C } from "../../../../config/constantes";

Chart.register(zoomPlugin);

@Component({
	selector: 'app-events',
	templateUrl: './events.component.html',
	styleUrls: ['./events.component.scss']
})
export class EventsComponent {

	C = C;
	@Input() events: EventGeco[] = [];
	@Input() players: Player[] = [];
	@Input() typeMoney = C.JUNE;


	getResourcesEmoji(color: string) {
		switch (color) {
			case "red":
				return "🟥";
			case "yellow":
				return "🟨";
			case "green":
				return "🟩";
			case "blue":
				return "🟦";
			default:
				return "⁉️";
		}
	}

	getPlayerName(idPlayer: string) {
		const player = _.find(this.players, p => p._id === idPlayer);
		return player ? player.name : "undefined";
	}

	getTextCard(card: Card) {
		return card.letter + this.getResourcesEmoji(card.color);
	}
}
