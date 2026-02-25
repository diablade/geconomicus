import { Component, Input } from '@angular/core';

@Component({
	selector: 'coin',
	templateUrl: './coin.component.html',
	styleUrls: ['./coin.component.scss'],
})
export class CoinComponent {
	@Input() coinImage: string = '';
	@Input() coinImageBack: string = this.coinImage;
	@Input() width: string = '150px';
	@Input() height: string = '150px';
	@Input() forceRotate: boolean = false;
	@Input() label: string = '';

	// coins = document.querySelectorAll('.coin, .coin-double-face');

	// coins.forEach(coin => {
	//     coin.addEventListener('click', function () {
	//         // Exemple: rotation de 180° supplémentaires à chaque clic
	//         const currentRotation = this.style.transform || 'rotateY(0deg)';
	//         const currentDegrees = parseInt(currentRotation.match(/\d+/) || 0);
	//         this.style.transform = `rotateY(${currentDegrees + 180}deg)`;
	//     });
	// });
}
