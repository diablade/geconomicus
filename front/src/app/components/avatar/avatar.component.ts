import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { Avatar } from '../../models/avatar';

@Component({
	selector: 'avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss'],
})
export class AvatarComponent implements AfterViewInit {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	@Input() width!: string;
	@Input() height!: string;
	private _avatar: Avatar = new Avatar();

	@Input()
	set avatar(value: Avatar | null) {
		if (!value) return;
		this._avatar = value;
		this.renderSvg();
	}

	get avatar(): Avatar {
		return this._avatar;
	}

	ngAfterViewInit() {
		// Au cas où l'avatar arrive avant que la vue soit prête
		this.renderSvg();
	}

	private renderSvg() {
		if (this.svgContainer?.nativeElement && this._avatar?.image) {
			this.svgContainer.nativeElement.innerHTML = this._avatar.image;
		}
	}
}
