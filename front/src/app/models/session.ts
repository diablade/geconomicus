import {Avatar} from "./avatar";
import {Rules} from "./rules";

export class Session {
	_id = "";
	name = "";
	animator = "";
	location = "";
	shortId = "";
	devMode = false;
	status = "open";    //open, in_progress, closed
	theme = "classic";
	gamesRules: Rules[] = [];
	gamesRulesCount = 0;
	avatars: Avatar[] = [];
	avatarsCount = 0;
	createdAt: Date = new Date();
	updatedAt: Date = new Date();
}
