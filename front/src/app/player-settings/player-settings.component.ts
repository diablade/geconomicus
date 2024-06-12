import {createAvatar, Options as Opt, schema} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {Player} from "../models/game";
import {BackService} from "../services/back.service";
import {faChevronLeft, faChevronRight, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";

@Component({
	selector: 'app-player-settings',
	templateUrl: './player-settings.component.html',
	styleUrls: ['./player-settings.component.scss']
})
export class PlayerSettingsComponent implements OnInit, OnDestroy {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	idGame: string | undefined;
	idPlayer: string | undefined;
	player: Player = new Player();
	private subscription: Subscription | undefined;
	options: Partial<adventurer.Options & Opt> = {};
	faChevronLeft = faChevronLeft;
	faChevronRight = faChevronRight;
	faWandMagicSparkles = faWandMagicSparkles;

	skin = "#f2d3b1";
	hairColor = "#ac6511";
	properties: any = {
		...schema.properties,
		...adventurer.schema.properties,
	};
	skinPalette: Array<any> = ['#f2d3b1', '#ecad80', '#9e5622', '#763900'];
	hairPalette: Array<any> = ['#ac6511', '#cb6820', '#ab2a18', '#e5d7a3', '#b9a05f', '#796a45', '#6a4e35', '#562306', '#0e0e0e', '#afafaf', '#3eac2c', '#85c2c6', '#dba3be', '#592454'];
	boardPalette: Array<any> = ['#d34b4b', '#b09946', '#36a746', '#3382ac', '#a86ccb', '#ffd89b', '#d56f15', '#0019aa64'];

	constructor(private route: ActivatedRoute, private router: Router, private backService: BackService) {

	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.idPlayer = params['idPlayer'];
			this.backService.getPlayer(this.idGame, this.idPlayer).subscribe(data => {
				this.player = data.player;
				if (this.player.image === "" || this.player.image === undefined) {
					this.randomize();
				} else {
					this.skin = "#" + this.player.skinColor;
					this.hairColor = "#" + this.player.hairColor;
					this.svgContainer.nativeElement.innerHTML = this.player.image;
				}
			});
		});
	}

	getBackgroundStyle() {
		switch (this.player.boardConf) {
			case "green":
				return {"background-image": "url('/assets/images/green-carpet.jpg')"};
			case "custom":
				return {"background-color": "" + this.player.boardColor};
			case "wood":
			default:
				return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
		}
	}

	changeEyes(increment: boolean) {
		if (increment && this.player.eyes < this.properties.eyes.default.length - 1) {
			this.player.eyes++;
		} else if (!increment && this.player.eyes > 0) {
			this.player.eyes--;
		} else if (increment && this.player.eyes == this.properties.eyes.default.length - 1) {
			this.player.eyes = 0;
		} else if (!increment && this.player.eyes == 0) {
			this.player.eyes = this.properties.eyes.default.length - 1;
		}
		this.updateSvg();
	}

	changeEarrings(increment: boolean) {
		if (increment && this.player.earrings < this.properties.earrings.default.length - 1) {
			this.player.earrings++;
		} else if (!increment && this.player.earrings > -1) {
			this.player.earrings--;
		} else if (increment && this.player.earrings == this.properties.earrings.default.length - 1) {
			this.player.earrings = -1;
		} else if (!increment && this.player.earrings == -1) {
			this.player.earrings = this.properties.earrings.default.length - 1;
		}
		this.updateSvg();
	}

	changeEyeBrows(increment: boolean) {
		if (increment && this.player.eyebrows < this.properties.eyebrows.default.length - 1) {
			this.player.eyebrows++;
		} else if (!increment && this.player.eyebrows > 0) {
			this.player.eyebrows--;
		} else if (increment && this.player.eyebrows == this.properties.eyebrows.default.length - 1) {
			this.player.eyebrows = 0;
		} else if (!increment && this.player.eyebrows == 0) {
			this.player.eyebrows = this.properties.eyebrows.default.length - 1;
		}
		this.updateSvg();
	}

	changeFeature(increment: boolean) {
		if (increment && this.player.features < this.properties.features.default.length - 1) {
			this.player.features++;
		} else if (!increment && this.player.features > -1) {
			this.player.features--;
		} else if (increment && this.player.features == this.properties.features.default.length - 1) {
			this.player.features = -1;
		} else if (!increment && this.player.features == -1) {
			this.player.features = this.properties.features.default.length - 1;
		}
		this.updateSvg();
	}

	changeHair(increment: boolean) {
		if (increment && this.player.hair < this.properties.hair.default.length - 1) {
			this.player.hair++;
		} else if (!increment && this.player.hair > 0) {
			this.player.hair--;
		} else if (increment && this.player.hair == this.properties.hair.default.length - 1) {
			this.player.hair = 0;
		} else if (!increment && this.player.hair == 0) {
			this.player.hair = this.properties.hair.default.length - 1;
		}
		this.updateSvg();
	}

	changeGlasses(increment: boolean) {
		if (increment && this.player.glasses < this.properties.glasses.default.length - 1) {
			this.player.glasses++;
		} else if (!increment && this.player.glasses > -1) {
			this.player.glasses--;
		} else if (increment && this.player.glasses == this.properties.glasses.default.length - 1) {
			this.player.glasses = -1;
		} else if (!increment && this.player.glasses == -1) {
			this.player.glasses = this.properties.glasses.default.length - 1;
		}
		this.updateSvg();
	}

	changeMouth(increment: boolean) {
		if (increment && this.player.mouth < this.properties.mouth.default.length - 1) {
			this.player.mouth++;
		} else if (!increment && this.player.mouth > 0) {
			this.player.mouth--;
		} else if (increment && this.player.mouth == this.properties.mouth.default.length - 1) {
			this.player.mouth = 0;
		} else if (!increment && this.player.mouth == 0) {
			this.player.mouth = this.properties.mouth.default.length - 1;
		}
		this.updateSvg();
	}

	changeSkin() {
		this.player.skinColor = this.skin.replace("#", "");
		this.updateSvg();
	}

	changeHairColor() {
		this.player.hairColor = this.hairColor.replace("#", "");
		this.updateSvg();
	}

	updateSvg() {
		this.options.hairColor = [this.player.hairColor];
		this.options.skinColor = [this.player.skinColor];
		this.options.mouth = [this.properties.mouth.default[this.player.mouth]];
		this.options.hair = [this.properties.hair.default[this.player.hair]];
		this.options.eyebrows = [this.properties.eyebrows.default[this.player.eyebrows]];
		this.options.eyes = [this.properties.eyes.default[this.player.eyes]];
		this.options.earrings = [this.properties.earrings.default[this.player.earrings]];
		this.options.glasses = [this.properties.glasses.default[this.player.glasses]];
		this.options.features = [this.properties.features.default[this.player.features]];
		this.options.glassesProbability = 100;
		this.options.featuresProbability = 100;
		this.options.earringsProbability = 100;
		this.options.hairProbability = 100;
		this.player.image = createAvatar(adventurer, this.options).toString();
		this.svgContainer.nativeElement.innerHTML = this.player.image;
	}

	close() {
		this.router.navigate(["game", this.idGame, "player", this.idPlayer]);
	}

	saveAndClose() {
		this.backService.updatePlayer(this.idGame, this.player).subscribe(() => {
			this.close();
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	getRandomInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	randomize() {
		this.player.earrings = this.getRandomInt(-1, this.properties.earrings.default.length-1);
		this.player.glasses = this.getRandomInt(-1, this.properties.glasses.default.length-1);
		this.player.features = this.getRandomInt(-1, this.properties.features.default.length-1);
		this.player.eyes = this.getRandomInt(0, this.properties.eyes.default.length-1);
		this.player.eyebrows = this.getRandomInt(0, this.properties.eyebrows.default.length-1);
		this.player.hair = this.getRandomInt(0, this.properties.hair.default.length-1);
		this.player.mouth = this.getRandomInt(0, this.properties.mouth.default.length-1);
		this.hairColor = this.hairPalette[this.getRandomInt(0, 13)];
		this.skin = this.skinPalette[this.getRandomInt(0, 3)];
		this.player.skinColor = this.skin.replace("#", "");
		this.player.hairColor = this.hairColor.replace("#", "");
		this.updateSvg();
	}
}
