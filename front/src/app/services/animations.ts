import {animate, state, animateChild, keyframes, query, style, transition, trigger} from "@angular/animations";

export const animations = [
	trigger('list', [
		transition(':enter', [
			query('@items', [
				animateChild()
			], {optional: true})
		]),
	]),
	trigger('item', [
		transition(':enter', [
			style({transform: 'translateY(-100rem)'}),
			animate('600ms ease-out', style({transform: 'translateY(0)'}))
		]),
		transition(':leave', [
			animate('600ms ease-in', style({transform: 'translateY(-100rem)'}))
		])
	]),
	trigger('coinFlip', [
		transition('void => *', []),
		transition('* => *', [
			animate('500ms ease-in-out',
				keyframes([
					style({
						transform: 'rotateY(0deg) scale(1.1)',
						offset: 0
					}),
					style({
						transform: 'rotateY(180deg) scale(1.1)',
						offset: 0.25
					}),
					style({
						transform: 'rotateY(360deg) scale(1.1)',
						offset: 0.5
					}),
					style({
						transform: 'rotateY(540deg) scale(1.1)',
						offset: 0.75
					}),
					style({
						transform: 'rotateY(720deg) scale(1)',
						offset: 1
					})
				])
			)
		])
	]),
	trigger('prisonDoor', [
		transition(':enter', [
			style({transform: 'translateX(-100rem)'}),
			animate('2000ms',
				style({transform: 'translateX(0rem)'}))
		]),
		transition(':leave', [
			style({transform: 'translateX(0rem)'}),
			animate('2000ms',
				style({transform: 'translateX(-100rem)'}))
		]),
	]),
	trigger("cardFlip", [
		state(
			"default",
			style({
				transform: "none",
				zIndex: "1"
			})
		),
		state(
			"flipped",
			style({
				transform: "rotateY(180deg) scale(2.2)",
				top: "{{translateY}}px",
				left: "{{translateX}}px",
				zIndex: "99",
			}),
			{params: {translateX: 10, translateY: 10}}
		),
		transition("default => flipped", [animate("350ms")]),
		transition("flipped => default", [animate("350ms")]),
	]),
	trigger("itemFlip", [
		state(
			"default",
			style({
				transform: "none",
				zIndex: "1",
				width: "{{width}}",
				height: "{{height}}",
			}),
			{params: {translateX: 0, translateY: 0, width: "{{width}}", height: "{{height}}"}}
		),
		state(
			"flipped",
			style({
				transform: "rotateY(180deg) scale(3.5)",
				zIndex: "99",
				top: "{{translateY}}px",
				left: "{{translateX}}px",
				width: "{{width}}",
				height: "100%",
			}),
			{params: {translateX: 0, translateY: 0, width: "{{width}}", height: "{{height}}"}}
		),
		transition("default => flipped", [animate("300ms")]),
		transition("flipped => default", [animate("300ms")]),
	])
];
