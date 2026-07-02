import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { Avatar } from '../../models/avatar';
import { ConnectionStatus } from 'src/app/models/gameState';
import { PLAYER_STATUS, PlayerStatus } from '@geco/shared';

@Component({
	selector: 'avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss'],
})
export class AvatarComponent implements AfterViewInit {
	protected readonly DEAD = PLAYER_STATUS.DEAD;
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	@Input() width!: string;
	@Input() height!: string;
	@Input() namePosition: 'right' | 'bottom' | 'none' = 'none';
	@Input() online: 'online' | 'none' | 'offline' = 'none';
	@Input() playerStatus: PlayerStatus | null = null;
	@Input() connection: ConnectionStatus | null = null;
	@Input() onlineStatus = false;
	@Input()
	set avatar(value: Partial<Avatar> | undefined) {
		if (!value) return;
		this._avatar = { ...this._avatar, ...value };
		this.renderSvg();
	}
	get avatar(): Partial<Avatar> {
		return this._avatar;
	}
	private _avatar: Partial<Avatar> = {};

	ngAfterViewInit() {
		// Au cas où l'avatar arrive avant que la vue soit prête
		this.renderSvg();
	}

	private renderSvg() {
		if (this.svgContainer?.nativeElement && this._avatar?.image) {
			this.svgContainer.nativeElement.innerHTML = this._avatar.image;
		}
	}

	getAlignment() {
		if (this.namePosition === 'right') {
			return 'flex-row gap-2';
		}
		if (this.namePosition === 'bottom') {
			return 'flex-column gap-1';
		}
		return '';
	}
}
