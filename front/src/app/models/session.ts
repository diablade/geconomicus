import {Avatar} from "./avatar";
import {Rules} from "./rules";

export class Session {
	_id: string = "";
	name: string = "";
	animator: string = "";
	location: string = "";
	shortId: string = "";
	devMode: boolean = false;
	status: string = "open";    //open, in_progress, closed
	theme: string = "classic";
	gamesRules: Rules[] = [];
	gamesRulesCount: number = 0;
	avatars: Avatar[] = [];
	avatarsCount: number = 0;
	createdAt: Date = new Date();
	updatedAt: Date = new Date();
}
