export class Event {
	typeEvent = '';
	emitter = '';
	receiver = '';
	amount = 0;
	resources: any[] = [];
	// @ts-ignore
	date: Date = Date.now();
}
