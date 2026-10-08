import { Component, Input } from '@angular/core';

@Component({
	selector: 'coin',
	templateUrl: './coin.component.html',
	styleUrls: ['./coin.component.scss'],
})
export class CoinComponent {
	@Input() coinImage = '';
	@Input() coinImageBack = this.coinImage;
	@Input() width = '150px';
	@Input() height = '150px';
	@Input() forceRotate = false;
	@Input() label = '';
}
