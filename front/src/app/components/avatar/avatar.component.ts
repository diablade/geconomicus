import {AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild} from '@angular/core';
import {Avatar} from '../../models/avatar';

@Component({
	selector: 'avatar',
	templateUrl: './avatar.component.html',
	styleUrls: ['./avatar.component.scss']
})
export class AvatarComponent implements AfterViewInit {
	@ViewChild('svgContainer') svgContainer!: ElementRef;
	@Input() width!: string;
	@Input() height!: string;
	private _avatar: Avatar = new Avatar();
	@Input()
	set avatar(value: Avatar) {
		this._avatar = value;
		if (this.svgContainer && value?.image) {
			this.svgContainer.nativeElement.innerHTML = value.image;
		}
	}

	get avatar(): Avatar {
		return this._avatar;
	}

	ngAfterViewInit(): void {
		if (this.avatar?.image) {
			this.svgContainer.nativeElement.innerHTML = this.avatar.image;
		}
	}
}
