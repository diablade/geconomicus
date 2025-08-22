import {Component, EventEmitter, Input, Output} from '@angular/core';
import {Receipe} from '../../models/receipes';
import {faCheck} from '@fortawesome/free-solid-svg-icons';

@Component({
	selector: 'app-receipe',
	templateUrl: './receipe.component.html',
	styleUrls: ['./receipe.component.scss']
})
export class ReceipeComponent {

	@Input() receipe: Receipe = new Receipe('', 0);
	@Input() width: string = 'calc(18vw)';
	@Input() height: string = 'calc(18vw * 1.5)';
	@Output() onReceipeCompleted: EventEmitter<Receipe> = new EventEmitter<Receipe>();
	faCheck = faCheck;

	constructor() {
	}

	ngOnInit(): void {

	}

	buildCardLvlUp() {
		this.onReceipeCompleted.emit(this.receipe);
	}

	getBuildText() {
		switch (this.receipe.weight) {
			case 0:
				return "CARD.BUILD_UP_0";
			case 1:
				return "CARD.BUILD_UP_1";
			case 2:
				return "CARD.BUILD_UP_2";
		}
		return "CARD.BUILD_UP";
	}

	getReceipeColor() {
		switch (this.receipe.weight) {
			case 0:
				return "red";
			case 1:
				return "yellow";
			case 2:
				return "green";
		}
		return "blue";
	}
}
