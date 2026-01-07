import { Avatar } from "./avatar";
import { Rules } from "./rules";

export class Session {
	name: string;
	animator: string;
	location: string;
	shortId: string;
	devMode: boolean;
	theme: string;
	gamesRules: Rules[];
	players: Avatar[];
}
