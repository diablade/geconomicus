import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, Router} from "@angular/router";
import {BackService} from "../services/back.service";
import {Subscription} from "rxjs";

@Component({
	selector: 'app-join',
	templateUrl: './join.component.html',
	styleUrls: ['./join.component.scss']
})
export class JoinComponent implements OnInit, OnDestroy {
	idGame = "";
	fromId: string | undefined;
	name = "";
	private subscription: Subscription | undefined;

	constructor(private route: ActivatedRoute, private router: Router, private backService: BackService) {
	}

	ngOnInit(): void {
		this.subscription = this.route.params.subscribe(params => {
			this.idGame = params['idGame'];
			this.fromId = params['fromId'];
			if (this.fromId) {
				this.name = params['name'];
				let audioAngel = new Audio("./assets/audios/angel.mp3");
				audioAngel.load();
				audioAngel.play();
			}
		});
	}

	//To prevent memory leak
	ngOnDestroy(): void {
		if (this.subscription)
			this.subscription.unsubscribe()
	}

	join() {
		this.backService.join(this.idGame, this.name).subscribe(idPlayer => {
			this.router.navigate(['game', this.idGame, 'player', idPlayer, 'settings']);
		});
	}

	joinReincarnate() {
		this.backService.joinReincarnate(this.idGame, this.name, this.fromId).subscribe(idPlayer => {
			this.router.navigate(['game', this.idGame, 'player', idPlayer]);
		});
	}
	//
	// joinInGame() {
	// 	this.backService.joinInGame(this.idGame, this.name).subscribe(idPlayer => {
	// 		this.router.navigate(['game', this.idGame, 'player', idPlayer, 'settings']);
	// 	});
	// }
}
