import { Component, Input } from '@angular/core';
import { ConnectionStatus } from 'src/app/models/gameState';

@Component({
	selector: 'online-status',
	templateUrl: './online-status.component.html',
	styleUrls: ['./online-status.component.scss'],
})
export class OnlineStatusComponent {
	@Input() connection: ConnectionStatus | null = null;
}
