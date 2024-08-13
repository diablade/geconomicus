import { Injectable } from '@angular/core';
import io from "socket.io-client";
import {environment} from "../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
	private socket: any = undefined;
	private ioURl: string = environment.API_HOST;
	private idGame: string | undefined;
	private idPlayer: string | undefined;

  constructor() {}

	private connect(idGame: string | undefined, idPlayer: string | undefined){
		this.idGame = idGame;
		this.idPlayer = idPlayer;
		if(idGame && idPlayer){
			this.socket = io(this.ioURl, {
				query: {
					idPlayer: this.idPlayer,
					idGame: this.idGame,
				},
			});
			return this.socket;
		}
	}

	getSocket(idGame: string | undefined, idPlayer: string | undefined) {
		if(this.socket){
			return this.socket;
		}
		else {
			return this.connect(idGame, idPlayer)
		}
	}
}
