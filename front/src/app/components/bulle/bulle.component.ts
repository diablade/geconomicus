import { Component, Input } from '@angular/core';

@Component({
	selector: 'bulle',
	templateUrl: './bulle.component.html',
	styleUrls: ['./bulle.component.scss'],
})
export class BulleComponent {
	@Input() pointer: boolean = false;
	@Input() contents: string[] = [];
}
