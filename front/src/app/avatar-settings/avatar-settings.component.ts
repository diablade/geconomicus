import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { faCamera, faChevronLeft, faChevronRight, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { LocalStorageService } from '../services/local-storage/local-storage.service';
import { AvatarService } from '../services/api/avatar.service';
import { Avatar } from '../models/avatar';
import { I18nService } from '../services/i18n.service';
import {
	createSvg,
	properties,
	getBackgroundStyle,
	hairPalette,
	skinPalette,
	boardPalette,
} from '../services/avatarTools';
import { SnackbarService } from '../services/snackbar.service';

@Component({
	selector: 'app-avatar-settings',
	templateUrl: './avatar-settings.component.html',
	styleUrls: ['./avatar-settings.component.scss'],
})
export class AvatarSettingsComponent implements OnInit, OnDestroy {
	protected readonly boardPalette = boardPalette;
	protected readonly properties = properties;
	protected readonly skinPalette = skinPalette;
	protected readonly hairPalette = hairPalette;
	getBackgroundStyle = getBackgroundStyle;
	sessionId = '';
	avatarIdx = 0;
	avatar: Avatar | undefined;
	subscription: Subscription | undefined;
	faChevronLeft = faChevronLeft;
	faChevronRight = faChevronRight;
	faWandMagicSparkles = faWandMagicSparkles;
	faCamera = faCamera;
	scanV3 = true;

	skin = '#f2d3b1';
	hairColor = '#ac6511';

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private avatarService: AvatarService,
		private localStorageService: LocalStorageService,
		private i18nService: I18nService,
		private toastr: SnackbarService
	) {
		this.i18nService.loadNamespace('avatar');
	}
	ngOnDestroy(): void {
		if (this.subscription) {
			this.subscription.unsubscribe();
		}
	}
	ngOnInit(): void {
		this.scanV3 = this.localStorageService.getItem('scanV3');
		this.subscription = this.route.params.subscribe((params) => {
			this.sessionId = params['sessionId'];
			this.avatarIdx = params['avatarIdx'];
			this.avatarService.loadAvatar(this.sessionId, this.avatarIdx, false).subscribe({
				next: (result) => {
					if (result.success && result.data) {
						const avatar = result.data.avatar ?? result.data;
						this.avatar = { ...avatar };
						if (this.avatar?.image === '' || this.avatar?.image === undefined) {
							this.randomize();
						} else {
							this.skin = '#' + this.avatar.skinColor;
							this.hairColor = '#' + this.avatar.hairColor;
							console.log('avatar chargé, image:', this.avatar.image?.substring(0, 50));
						}
					}
				},
				error: (err) => {
					this.toastr.showError(this.i18nService.instant('ERROR.UNKNOWN'));
				},
			});
		});
	}

	saveAndClose() {
		this.avatarService.updateAvatar(this.sessionId, this.avatarIdx, this.avatar!).subscribe({
			next: (result) => {
				if (result.success) {
					this.toastr.showSuccess(this.i18nService.instant('AVATAR.UPDATED'));
					this.close();
				} else {
					this.toastr.showError(this.i18nService.instant(result.error || 'ERROR.UNKNOWN'));
				}
			},
			error: (err) => {
				this.toastr.showError(this.i18nService.instant(err.error || 'ERROR.UNKNOWN'));
			},
		});
	}
	close() {
		this.router.navigate(['avatar', this.sessionId, this.avatarIdx]);
	}

	changeBoardColor(color: string) {
		console.log(color);
		// this.avatar.boardColor = color;
	}

	onChangeSysScan() {
		this.localStorageService.setItem('scanV3', this.scanV3);
	}

	changeEyes(increment: boolean) {
		if (increment && this.avatar!.eyes < properties.eyes.default.length - 1) {
			this.avatar!.eyes++;
		} else if (!increment && this.avatar!.eyes > 0) {
			this.avatar!.eyes--;
		} else if (increment && this.avatar?.eyes == properties.eyes.default.length - 1) {
			this.avatar!.eyes = 0;
		} else if (!increment && this.avatar?.eyes == 0) {
			this.avatar!.eyes = properties.eyes.default.length - 1;
		}
		this.updateSvg();
	}

	changeEarrings(increment: boolean) {
		if (increment && this.avatar!.earrings < properties.earrings.default.length - 1) {
			this.avatar!.earrings++;
		} else if (!increment && this.avatar!.earrings > -1) {
			this.avatar!.earrings--;
		} else if (increment && this.avatar!.earrings == properties.earrings.default.length - 1) {
			this.avatar!.earrings = -1;
		} else if (!increment && this.avatar!.earrings == -1) {
			this.avatar!.earrings = properties.earrings.default.length - 1;
		}
		this.updateSvg();
	}

	changeEyeBrows(increment: boolean) {
		if (increment && this.avatar!.eyebrows < properties.eyebrows.default.length - 1) {
			this.avatar!.eyebrows++;
		} else if (!increment && this.avatar!.eyebrows > 0) {
			this.avatar!.eyebrows--;
		} else if (increment && this.avatar!.eyebrows == properties.eyebrows.default.length - 1) {
			this.avatar!.eyebrows = 0;
		} else if (!increment && this.avatar!.eyebrows == 0) {
			this.avatar!.eyebrows = properties.eyebrows.default.length - 1;
		}
		this.updateSvg();
	}

	changeFeature(increment: boolean) {
		if (increment && this.avatar!.features < properties.features.default.length - 1) {
			this.avatar!.features++;
		} else if (!increment && this.avatar!.features > -1) {
			this.avatar!.features--;
		} else if (increment && this.avatar!.features == properties.features.default.length - 1) {
			this.avatar!.features = -1;
		} else if (!increment && this.avatar!.features == -1) {
			this.avatar!.features = properties.features.default.length - 1;
		}
		this.updateSvg();
	}

	changeHair(increment: boolean) {
		if (increment && this.avatar!.hair < properties.hair.default.length - 1) {
			this.avatar!.hair++;
		} else if (!increment && this.avatar!.hair > 0) {
			this.avatar!.hair--;
		} else if (increment && this.avatar!.hair == properties.hair.default.length - 1) {
			this.avatar!.hair = 0;
		} else if (!increment && this.avatar!.hair == 0) {
			this.avatar!.hair = properties.hair.default.length - 1;
		}
		this.updateSvg();
	}

	changeGlasses(increment: boolean) {
		if (increment && this.avatar!.glasses < properties.glasses.default.length - 1) {
			this.avatar!.glasses++;
		} else if (!increment && this.avatar!.glasses > -1) {
			this.avatar!.glasses--;
		} else if (increment && this.avatar!.glasses == properties.glasses.default.length - 1) {
			this.avatar!.glasses = -1;
		} else if (!increment && this.avatar!.glasses == -1) {
			this.avatar!.glasses = properties.glasses.default.length - 1;
		}
		this.updateSvg();
	}

	changeMouth(increment: boolean) {
		if (increment && this.avatar!.mouth < properties.mouth.default.length - 1) {
			this.avatar!.mouth++;
		} else if (!increment && this.avatar!.mouth > 0) {
			this.avatar!.mouth--;
		} else if (increment && this.avatar!.mouth == properties.mouth.default.length - 1) {
			this.avatar!.mouth = 0;
		} else if (!increment && this.avatar!.mouth == 0) {
			this.avatar!.mouth = properties.mouth.default.length - 1;
		}
		this.updateSvg();
	}

	changeSkin() {
		this.avatar!.skinColor = this.skin.replace('#', '');
		this.updateSvg();
	}

	changeHairColor() {
		this.avatar!.hairColor = this.hairColor.replace('#', '');
		this.updateSvg();
	}

	updateSvg() {
		// this.avatar.image = createSvg(this.avatar);
		this.avatar = { ...this.avatar!, image: createSvg(this.avatar!) };
	}

	getRandomInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1) + min);
	}

	randomize() {
		console.log('RANDOMIZE AVATAR CALLED');
		this.avatar!.earrings = this.getRandomInt(-1, properties.earrings.default.length - 1);
		this.avatar!.glasses = this.getRandomInt(-1, properties.glasses.default.length - 1);
		this.avatar!.features = this.getRandomInt(-1, properties.features.default.length - 1);
		this.avatar!.eyes = this.getRandomInt(0, properties.eyes.default.length - 1);
		this.avatar!.eyebrows = this.getRandomInt(0, properties.eyebrows.default.length - 1);
		this.avatar!.hair = this.getRandomInt(0, properties.hair.default.length - 1);
		this.avatar!.mouth = this.getRandomInt(0, properties.mouth.default.length - 1);
		this.hairColor = hairPalette[this.getRandomInt(0, 13)];
		this.skin = skinPalette[this.getRandomInt(0, 3)];
		this.avatar!.skinColor = this.skin.replace('#', '');
		this.avatar!.hairColor = this.hairColor.replace('#', '');
		this.avatar = { ...this.avatar!, image: createSvg(this.avatar!) };
		// this.updateSvg();
	}
}
