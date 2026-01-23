import {createAvatar, Options as Opt, schema} from '@dicebear/core';
import {adventurer} from '@dicebear/collection';
import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Subscription} from "rxjs";
import {ActivatedRoute, Router} from "@angular/router";
import {faCamera, faChevronLeft, faChevronRight, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import {LocalStorageService} from "../services/local-storage/local-storage.service";
import {AvatarService} from "../services/api/avatar.service";
import {Avatar} from "../models/avatar";
import {I18nService} from "../services/i18n.service";

@Component({
	selector: 'app-player-settings',
	templateUrl: './player-settings.component.html',
	styleUrls: ['./player-settings.component.scss']
})
export class PlayerSettingsComponent implements OnInit, OnDestroy {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	sessionId: string = "";
	avatarIdx: string = "";
	avatar: Avatar = new Avatar();
	private subscription: Subscription | undefined;
	options: Partial<adventurer.Options & Opt> = {};
	faChevronLeft = faChevronLeft;
	faChevronRight = faChevronRight;
	faWandMagicSparkles = faWandMagicSparkles;
	scanV3 = true;

	skin = "#f2d3b1";
	hairColor = "#ac6511";
	properties: any = {
		...schema.properties,
		...adventurer.schema.properties,
	};
	skinPalette: Array<any> = ['#f2d3b1', '#ecad80', '#9e5622', '#763900', '#371d00', '#ffffff', '#000000'];
	hairPalette: Array<any> =
		[
			'#000000', // noir intense
			'#808080', // gris (argent)
			'#ffffff', // blanc (albinos/âgé)
			'#5a3e2b', // brun chaud
			'#a9745a', // brun clair
			'#e2b77b', // blond foncé
			'#d8bfd8', // lavande pastel (fantaisie)
			'#fff0b3', // blond très clair
			'#ffff00', // super sayian
			'#aeff00', // broly
			'#32cd32', // vert lime
			'#00ced1', // turquoise
			'#7fa0ff', // bleu clair
			'#0033e5', // bleu foncé
			'#6a5acd', // violet électrique
			'#900000', // rouge foncé
			'#c71585', // magenta foncé
			'#ff69b4', // rose flashy
			'#ff6e6e', // saumon
			'#d2691e', // roux foncé
		]

	boardPalette: Array<any> = ['#d34b4b', '#b09946', '#36a746', '#3382ac', '#a86ccb', '#ffd89b', '#d56f15', '#0019aa64'];

	constructor(private route: ActivatedRoute, private router: Router, private avatarService: AvatarService, private localStorageService: LocalStorageService, private i18nService: I18nService) {
		this.i18nService.loadNamespace("avatar");
	}

	ngOnInit(): void {
		this.scanV3 = this.localStorageService.getItem("scanV3");
		this.subscription = this.route.params.subscribe(params => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.loadAvatar();
		});
	}

	loadAvatar() {
		this.avatarService.getAvatar(this.sessionId, this.avatarIdx).subscribe(data => {
			this.avatar = data;
			if (this.avatar.image === "" || this.avatar.image === undefined) {
				this.randomize();
			} else {
				this.skin = "#" + this.avatar.skinColor;
				this.hairColor = "#" + this.avatar.hairColor;
				this.svgContainer.nativeElement.innerHTML = this.avatar.image;
			}
		});
	}

	onChangeSysScan() {
		this.localStorageService.setItem('scanV3', this.scanV3);
	}

	getBackgroundStyle() {
		switch (this.avatar.boardConf) {
			case "green":
				return {"background-image": "url('/assets/images/green-carpet.jpg')"};
			case "custom":
				return {"background-color": "" + this.avatar.boardColor};
			case "wood":
			default:
				return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
		}
	}

	changeEyes(increment: boolean) {
		if (increment && this.avatar.eyes < this.properties.eyes.default.length - 1) {
			this.avatar.eyes++;
		} else if (!increment && this.avatar.eyes > 0) {
			this.avatar.eyes--;
		} else if (increment && this.avatar.eyes == this.properties.eyes.default.length - 1) {
			this.avatar.eyes = 0;
		} else if (!increment && this.avatar.eyes == 0) {
			this.avatar.eyes = this.properties.eyes.default.length - 1;
		}
		this.updateSvg();
	}

	changeEarrings(increment: boolean) {
		if (increment && this.avatar.earrings < this.properties.earrings.default.length - 1) {
			this.avatar.earrings++;
		} else if (!increment && this.avatar.earrings > -1) {
			this.avatar.earrings--;
		} else if (increment && this.avatar.earrings == this.properties.earrings.default.length - 1) {
			this.avatar.earrings = -1;
		} else if (!increment && this.avatar.earrings == -1) {
			this.avatar.earrings = this.properties.earrings.default.length - 1;
		}
		this.updateSvg();
	}

	changeEyeBrows(increment: boolean) {
		if (increment && this.avatar.eyebrows < this.properties.eyebrows.default.length - 1) {
			this.avatar.eyebrows++;
		} else if (!increment && this.avatar.eyebrows > 0) {
			this.avatar.eyebrows--;
		} else if (increment && this.avatar.eyebrows == this.properties.eyebrows.default.length - 1) {
			this.avatar.eyebrows = 0;
		} else if (!increment && this.avatar.eyebrows == 0) {
			this.avatar.eyebrows = this.properties.eyebrows.default.length - 1;
		}
		this.updateSvg();
	}

	changeFeature(increment: boolean) {
		if (increment && this.avatar.features < this.properties.features.default.length - 1) {
			this.avatar.features++;
		} else if (!increment && this.avatar.features > -1) {
			this.avatar.features--;
		} else if (increment && this.avatar.features == this.properties.features.default.length - 1) {
			this.avatar.features = -1;
		} else if (!increment && this.avatar.features == -1) {
			this.avatar.features = this.properties.features.default.length - 1;
		}
		this.updateSvg();
	}

	changeHair(increment: boolean) {
		if (increment && this.avatar.hair < this.properties.hair.default.length - 1) {
			this.avatar.hair++;
		} else if (!increment && this.avatar.hair > 0) {
			this.avatar.hair--;
		} else if (increment && this.avatar.hair == this.properties.hair.default.length - 1) {
			this.avatar.hair = 0;
		} else if (!increment && this.avatar.hair == 0) {
			this.avatar.hair = this.properties.hair.default.length - 1;
		}
		this.updateSvg();
	}

	changeGlasses(increment: boolean) {
		if (increment && this.avatar.glasses < this.properties.glasses.default.length - 1) {
			this.avatar.glasses++;
		} else if (!increment && this.avatar.glasses > -1) {
			this.avatar.glasses--;
		} else if (increment && this.avatar.glasses == this.properties.glasses.default.length - 1) {
			this.avatar.glasses = -1;
		} else if (!increment && this.avatar.glasses == -1) {
			this.avatar.glasses = this.properties.glasses.default.length - 1;
		}
		this.updateSvg();
	}

	changeMouth(increment: boolean) {
		if (increment && this.avatar.mouth < this.properties.mouth.default.length - 1) {
			this.avatar.mouth++;
		} else if (!increment && this.avatar.mouth > 0) {
			this.avatar.mouth--;
		} else if (increment && this.avatar.mouth == this.properties.mouth.default.length - 1) {
			this.avatar.mouth = 0;
		} else if (!increment && this.avatar.mouth == 0) {
			this.avatar.mouth = this.properties.mouth.default.length - 1;
		}
		this.updateSvg();
	}

	changeSkin() {
		this.avatar.skinColor = this.skin.replace("#", "");
		this.updateSvg();
	}

	changeHairColor() {
		this.avatar.hairColor = this.hairColor.replace("#", "");
		this.updateSvg();
	}

	updateSvg() {
		this.options.hairColor = [this.avatar.hairColor];
		this.options.skinColor = [this.avatar.skinColor];
		this.options.mouth = [this.properties.mouth.default[this.avatar.mouth]];
		this.options.hair = [this.properties.hair.default[this.avatar.hair]];
		this.options.eyebrows = [this.properties.eyebrows.default[this.avatar.eyebrows]];
		this.options.eyes = [this.properties.eyes.default[this.avatar.eyes]];
		this.options.earrings = [this.properties.earrings.default[this.avatar.earrings]];
		this.options.glasses = [this.properties.glasses.default[this.avatar.glasses]];
		this.options.features = [this.properties.features.default[this.avatar.features]];
		this.options.glassesProbability = 100;
		this.options.featuresProbability = 100;
		this.options.earringsProbability = 100;
		this.options.hairProbability = 100;
		this.avatar.image = createAvatar(adventurer, this.options).toString();
		this.svgContainer.nativeElement.innerHTML = this.avatar.image;
	}

	close() {
		this.router.navigate(["avatar", this.sessionId, this.avatarIdx]);
	}

	saveAndClose() {
		this.avatarService.updateAvatar(this.sessionId, this.avatarIdx, this.avatar).subscribe(() => {
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
		this.avatar.earrings = this.getRandomInt(-1, this.properties.earrings.default.length - 1);
		this.avatar.glasses = this.getRandomInt(-1, this.properties.glasses.default.length - 1);
		this.avatar.features = this.getRandomInt(-1, this.properties.features.default.length - 1);
		this.avatar.eyes = this.getRandomInt(0, this.properties.eyes.default.length - 1);
		this.avatar.eyebrows = this.getRandomInt(0, this.properties.eyebrows.default.length - 1);
		this.avatar.hair = this.getRandomInt(0, this.properties.hair.default.length - 1);
		this.avatar.mouth = this.getRandomInt(0, this.properties.mouth.default.length - 1);
		this.hairColor = this.hairPalette[this.getRandomInt(0, 13)];
		this.skin = this.skinPalette[this.getRandomInt(0, 3)];
		this.avatar.skinColor = this.skin.replace("#", "");
		this.avatar.hairColor = this.hairColor.replace("#", "");
		this.updateSvg();
	}

	protected readonly faCamera = faCamera;
}
