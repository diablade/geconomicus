import { Component, Inject, AfterViewInit, ViewChildren, QueryList, ElementRef, HostListener } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { I18nService } from 'src/app/services/i18n.service';

export interface TutorialSlide {
	icon: string;
	title: string;
	description: string;
	videoSrc: string;
}

const TUTORIAL_SLIDES: TutorialSlide[] = [
	{
		icon: '🃏',
		title: 'TUTORIAL.CARDS.TITLE',
		description: 'TUTORIAL.CARDS.DESC',
		videoSrc: 'assets/tutorial/01-cards.png',
	},
	{
		icon: '💰',
		title: 'TUTORIAL.WEALTH.TITLE',
		description: 'TUTORIAL.WEALTH.DESC',
		videoSrc: 'assets/tutorial/02-wealth.png',
	},
	{
		icon: '🏭',
		title: 'TUTORIAL.PRODUCTION.TITLE',
		description: 'TUTORIAL.PRODUCTION.DESC',
		videoSrc: 'assets/tutorial/03-production.mp4',
	},
	{
		icon: '🤝',
		title: 'TUTORIAL.ACQUIRE.TITLE',
		description: 'TUTORIAL.ACQUIRE.DESC',
		videoSrc: 'assets/tutorial/04-transaction.mp4',
	},
	{
		icon: '⚡',
		title: 'TUTORIAL.ACTIONS.TITLE',
		description: 'TUTORIAL.ACTIONS.DESC',
		videoSrc: 'assets/tutorial/05-actions.mp4',
	},
	{
		icon: '🌱',
		title: 'TUTORIAL.JUNE.TITLE',
		description: 'TUTORIAL.JUNE.DESC',
		videoSrc: 'assets/tutorial/06-june.mp4',
	},
	{
		icon: '🏦',
		title: 'TUTORIAL.DEBT.TITLE',
		description: 'TUTORIAL.DEBT.DESC',
		videoSrc: 'assets/tutorial/07-debt.mp4',
	},
	{
		icon: '🔁',
		title: 'TUTORIAL.REPAYMENT.TITLE',
		description: 'TUTORIAL.REPAYMENT.DESC',
		videoSrc: 'assets/tutorial/08-repayment.png',
	},
	{
		icon: '🚓',
		title: 'TUTORIAL.SEIZURE.TITLE',
		description: 'TUTORIAL.SEIZURE.DESC',
		videoSrc: 'assets/tutorial/09-seizure.mp4',
	},
	{
		icon: '💀',
		title: 'TUTORIAL.DEATH.TITLE',
		description: 'TUTORIAL.DEATH.DESC',
		videoSrc: 'assets/tutorial/10-death.mp4',
	},
];

@Component({
	selector: 'app-tutorial-dialog',
	templateUrl: './tutorial-dialog.component.html',
	styleUrls: ['./tutorial-dialog.component.scss'],
})
export class TutorialDialogComponent implements AfterViewInit {
	readonly slides = TUTORIAL_SLIDES;
	currentIndex = 0;
	private touchStartX = 0;

	@ViewChildren('videoEl') videoEls!: QueryList<ElementRef<HTMLVideoElement>>;

	constructor(
		public dialogRef: MatDialogRef<TutorialDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: unknown,
		private i18n: I18nService,
	) {
		this.i18n.loadNamespace('tutorial');
	}

	ngAfterViewInit(): void {
		this.playCurrentVideo();
	}

	/** Tells whether the slide media is a still image rather than a video. */
	isImage(slide: TutorialSlide): boolean {
		return /\.(png|jpe?g|webp|gif)$/i.test(slide.videoSrc);
	}

	get currentSlide(): TutorialSlide {
		return this.slides[this.currentIndex];
	}

	get isFirst(): boolean {
		return this.currentIndex === 0;
	}

	get isLast(): boolean {
		return this.currentIndex === this.slides.length - 1;
	}

	goTo(index: number): void {
		if (index === this.currentIndex || index < 0 || index >= this.slides.length) return;
		this.currentIndex = index;
		this.syncVideo();
	}

	/** Remembers where a swipe on the media started. */
	onTouchStart(event: TouchEvent): void {
		this.touchStartX = event.changedTouches[0].clientX;
	}

	/** Moves to the next or previous slide when the finger swiped far enough sideways. */
	onTouchEnd(event: TouchEvent): void {
		const dx = event.changedTouches[0].clientX - this.touchStartX;
		if (Math.abs(dx) > 40) this.goTo(this.currentIndex + (dx < 0 ? 1 : -1));
	}

	/** Lets the left and right arrow keys move through the slides. */
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowRight') this.goTo(this.currentIndex + 1);
		else if (event.key === 'ArrowLeft') this.goTo(this.currentIndex - 1);
	}

	close(): void {
		this.pauseAll();
		this.dialogRef.close();
	}

	private syncVideo(): void {
		const els = this.videoEls?.toArray() ?? [];
		els.forEach((ref) => {
			const el = ref.nativeElement;
			if (Number(el.dataset['index']) === this.currentIndex) {
				el.currentTime = 0;
				el.play();
			} else {
				el.pause();
			}
		});
	}

	private playCurrentVideo(): void {
		const els = this.videoEls?.toArray() ?? [];
		els.find((ref) => Number(ref.nativeElement.dataset['index']) === this.currentIndex)?.nativeElement.play();
	}

	private pauseAll(): void {
		this.videoEls?.forEach((ref) => ref.nativeElement.pause());
	}
}
