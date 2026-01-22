import {Avatar} from "./avatar";
import {Rules} from "./rules";

export class Session {
	_id: string = "";
	name: string = "";
	animator: string = "";
	location: string = "";
	shortId: string = "";
	devMode: boolean = false;
	status: string = "open";
	theme: string = "classic";
	gamesRules: Rules[] = [];
	gamesRulesCount: number = 0;
	players: Avatar[] = [];
	playersCount: number = 0;
	createdAt: Date = new Date();
	updatedAt: Date = new Date();
}
