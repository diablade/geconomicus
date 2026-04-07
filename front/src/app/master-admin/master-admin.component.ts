import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {Card, Game, Player} from "../models/game";
import {ActivatedRoute} from "@angular/router";
import {DeprecatedBackService} from "../services/deprecated-back.service";
import {DomSanitizer, SafeHtml} from "@angular/platform-browser";
import * as _ from "lodash-es";
import {SnackbarService} from "../services/snackbar.service";
import {environment} from 'src/environments/environment';
import {schema} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {createAvatar, Options as Opt} from '@dicebear/core';
// @ts-ignore
import * as C from '../../../../back/config/constantes_deprecated.cjs';
import {getBackgroundStyle, hairPalette} from "../services/avatarTools";

@Component({
	selector: 'app-master-admin',
	templateUrl: './master-admin.component.html',
	styleUrls: ['./master-admin.component.scss']
})
export class MasterAdminComponent implements OnInit {
	protected readonly getBackgroundStyle = getBackgroundStyle;
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	C = C;
	idGame = "";
	game: any;

	deck1: Card[] = [];
	deck2: Card[] = [];
	deck3: Card[] = [];
	deck4: Card[] = [];

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
				const paletteAvailable = _.filter(hairPalette, color => !colorsUsed.has(color));
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
