import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Card, Game, Player } from "../models/game";
import { ActivatedRoute } from "@angular/router";
import { DeprecatedBackService } from "../services/deprecated-back.service";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import * as _ from "lodash-es";
import { SnackbarService } from "../services/snackbar.service";
import { environment } from 'src/environments/environment';
import { schema } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { createAvatar, Options as Opt } from '@dicebear/core';
// @ts-ignore
import { C } from '../../../../back/shared/constantes.mjs';

@Component({
	selector: 'app-master-admin',
	templateUrl: './master-admin.component.html',
	styleUrls: ['./master-admin.component.scss']
})
export class MasterAdminComponent implements OnInit {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	C = C;
	idGame = "";
	game: any;

	deck1: Card[] = [];
	deck2: Card[] = [];
	deck3: Card[] = [];
	deck4: Card[] = [];

	options: Partial<adventurer.Options & Opt> = {};
	properties: any = {
		...schema.properties,
		...adventurer.schema.properties,
	};
	hairPalette: Array<any> =
		[
			'000000', // noir intense
			'808080', // gris (argent)
			'ffffff', // blanc (albinos/âgé)
			'5a3e2b', // brun chaud
			'a9745a', // brun clair
			'e2b77b', // blond foncé
			'fff0b3', // blond très clair
			'ffff00', // super sayian
			'aeff00', // broly
			'd8bfd8', // lavande pastel (fantaisie)
			'ff69b4', // rose flashy
			'c71585', // magenta foncé
			'6a5acd', // violet électrique
			'7fa0ff', // bleu stylisé
			'0033e5', // bleu foncé
			'00ced1', // turquoise
			'32cd32', // vert lime
			'900000', // rouge foncé
			'ff6e6e', // saumon
			'd2691e', // roux foncé
		];

	constructor(private route: ActivatedRoute,
		private backService: DeprecatedBackService,
		private sanitizer: DomSanitizer,
		private snackbarService: SnackbarService) {
	}

	ngOnInit(): void {
		this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			// this.socket = this.socket = this.wsService.getSocket(this.idGame, this.idGame + "master");
			this.backService.getGame(this.idGame).subscribe(game => {
				this.game = game;
				this.deck1 = this.countOccurrencesAndHideDuplicates(game.decks[0]);
				this.deck2 = this.countOccurrencesAndHideDuplicates(game.decks[1]);
				this.deck3 = this.countOccurrencesAndHideDuplicates(game.decks[2]);
				this.deck4 = this.countOccurrencesAndHideDuplicates(game.decks[3]);
				for (let player of game.players) {
					player.cards = this.countOccurrencesAndHideDuplicates(player.cards);
				}
			});
		});
	}

	getBackgroundStyle(player: Player) {
		switch (player.boardConf) {
			case "green":
				return { "background-image": "url('/assets/images/green-carpet.jpg')" };
			case "custom":
				return { "background-color": "" + player.boardColor };
			case "wood":
			default:
				return { "background-image": "url('/assets/images/woodJapAlt.jpg')" };
		}
	}

	getSanitizedSvgFromString(svgString: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svgString);
	}


	countOccurrencesAndHideDuplicates(cards: Card[]) {
		cards = _.orderBy(cards, ["weight", "letter"], ["asc"]);
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
		return cards;
	}

	getAlivePlayers() {
		return this.game?.players.filter((player: Player) => player.status === 'alive');
	}

	getDeadPlayers() {
		return this.game?.players.filter((player: Player) => player.status === 'dead');
	}

	refreshForceAllPlayers() {
		this.backService.refreshForceAllPlayers(this.idGame).subscribe(data => {
			if (data) {
				this.snackbarService.showSuccess("Refresh force all players");
			}
		});
	}

	refresh() {
		window.location.reload();
	}

	async nextColorForDuplicateColorHair() {
		const colorsUsed = new Set(this.game.players.map((player: Player) => player.hairColor));

		// check player with same hair color
		const grouped = Object.values(this.game.players.reduce((acc: any, player: Player) => {
			if (player.status === 'alive') {
				const color = player.hairColor;
				acc[color] = acc[color] || [];
				acc[color].push(player);
			}
			return acc;
		}, {}));

		// //remove alone
		const groupedWithoutAlone = grouped.filter((group: any) => group.length > 1);

		//then change one of those duplicate
		let playersWithChangedColor: Player[] = [];
		groupedWithoutAlone.forEach((group: any) => {
			for (let i = 1; i < group.length; i++) {
				const paletteAvailable = _.filter(this.hairPalette, color => !colorsUsed.has(color));
				const randomIndex = _.random(0, (paletteAvailable.length - 1), false)
				const nextColor = paletteAvailable[randomIndex];
				colorsUsed.add(nextColor);
				let player = group[i];
				player.hairColor = nextColor;
				player.image = this.updateSvg(player);
				playersWithChangedColor.push(player);
			}
		});

		// update players
		for (let i = 0; i < playersWithChangedColor.length; i++) {
			this.backService.updatePlayer(this.idGame, playersWithChangedColor[i]).subscribe(
				data => {
					if (data) {
						this.snackbarService.showSuccess("color applied for player: " + playersWithChangedColor[i].name);
						this.forceRefreshPlayer(playersWithChangedColor[i]);
					}
				}
			);
		}
	}

	forceRefreshPlayer(player: Player) {
		this.snackbarService.showSuccess("Refresh Sended for player: " + player.name);
		this.backService.refreshForcePlayer(this.idGame, player._id).subscribe();
	}


	updateSvg(player: Player) {
		let options: Partial<adventurer.Options & Opt> = {};
		let properties: any = {
			...schema.properties,
			...adventurer.schema.properties,
		};

		options.hairColor = [player.hairColor];
		options.skinColor = [player.skinColor];
		options.mouth = [properties.mouth.default[player.mouth]];
		options.hair = [properties.hair.default[player.hair]];
		options.eyebrows = [properties.eyebrows.default[player.eyebrows]];
		options.eyes = [properties.eyes.default[player.eyes]];
		options.earrings = [properties.earrings.default[player.earrings]];
		options.glasses = [properties.glasses.default[player.glasses]];
		options.features = [properties.features.default[player.features]];
		options.glassesProbability = 100;
		options.featuresProbability = 100;
		options.earringsProbability = 100;
		options.hairProbability = 100;
		const avatar = createAvatar(adventurer, options).toString();
		return avatar;
	}

	getUserUrl(idPlayer: string) {
		return environment.WEB_HOST + '/ogame/' + this.idGame + '/player/' + idPlayer;
	}
}
