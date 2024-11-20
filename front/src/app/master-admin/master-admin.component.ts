import {Component, OnInit} from '@angular/core';
import {Game} from "../models/game";
import {ActivatedRoute, Router} from "@angular/router";
import {MatDialog} from "@angular/material/dialog";
import {BackService} from "../services/back.service";
import {WebSocketService} from "../services/web-socket.service";
import {SnackbarService} from "../services/snackbar.service";

@Component({
	selector: 'app-master-admin',
	templateUrl: './master-admin.component.html',
	styleUrls: ['./master-admin.component.scss']
})
export class MasterAdminComponent implements OnInit {
	idGame = "";
	game: any;

	constructor(private route: ActivatedRoute,
							private router: Router,
							private backService: BackService,
							private wsService: WebSocketService,
							private snackbarService: SnackbarService) {
	}

	ngOnInit(): void {
		this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			// this.socket = this.socket = this.wsService.getSocket(this.idGame, this.idGame + "master");
			this.backService.getGame(this.idGame).subscribe(game => {
				this.game = game;
			});

			// this.data = environment.WEB_HOST + environment.GAME.GET + this.idGame + '/join';
		});
	}

}
