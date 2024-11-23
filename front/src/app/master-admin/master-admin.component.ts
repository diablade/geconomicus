import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Card, Game, Player} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {BackService} from "../services/back.service";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import * as _ from "lodash-es";

@Component({
	selector: 'app-master-admin',
	templateUrl: './master-admin.component.html',
	styleUrls: ['./master-admin.component.scss']
})
export class MasterAdminComponent implements OnInit {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	idGame = "";
	game: any;

	constructor(private route: ActivatedRoute,
							private backService: BackService,
							private sanitizer: DomSanitizer,) {
	}

	ngOnInit(): void {
		this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			// this.socket = this.socket = this.wsService.getSocket(this.idGame, this.idGame + "master");
			this.backService.getGame(this.idGame).subscribe(game => {
				this.game = game;
				for(let deck of game.decks){
					this.countOccurrencesAndHideDuplicates(deck);
				}
				for(let player of game.players){
					this.countOccurrencesAndHideDuplicates(player.cards);
				}
			});
		});
	}

	getBackgroundStyle(player: Player) {
		switch (player.boardConf) {
			case "green":
				return {"background-image": "url('/assets/images/green-carpet.jpg')"};
			case "custom":
				return {"background-color": "" + player.boardColor};
			case "wood":
			default:
				return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
		}
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
	}


	countOccurrencesAndHideDuplicates(cards:Card[]) {
		_.orderBy(cards, ["weight", "letter"]);
		const countByResult = _.countBy(cards, (obj: any) => `${obj.weight}-${obj.letter}`);
		const keyDuplicates: string[] = [];
		for (const c of cards) {
			const countKey = `${c.weight}-${c.letter}`;
			c.count = countByResult[countKey] || 0;
			const existCountKey = _.find(keyDuplicates, (k: string) => k === countKey);
			if (c.count > 1 && existCountKey) {
				c.displayed = false;
			}
			if (c.count >= 1 && !existCountKey) {
				keyDuplicates.push(countKey);
				c.displayed = true;
			}
		}
	}
}
