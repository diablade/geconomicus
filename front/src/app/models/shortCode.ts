import * as _ from 'lodash-es';

export class ShortCode {
	payload: string = "";
	code: string = "";

	constructor(payload: string, suffix: string | undefined) {
		this.payload = payload;
		this.code = suffix?suffix+_.random(0, 9): _.random(0, 999).toString();
	}
}
