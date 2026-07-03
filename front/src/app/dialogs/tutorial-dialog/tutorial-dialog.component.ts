import { Component, Inject, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { I18nService } from 'src/app/services/i18n.service';

export interface TutorialSlide {
	title: string;
	description: string;
	videoSrc: string;
}

const TUTORIAL_SLIDES: TutorialSlide[] = [
	{
		title: 'TUTORIAL.CARDS.TITLE',
		description: 'TUTORIAL.CARDS.DESC',
		videoSrc: 'assets/videos/tutorial/01-cards.mp4',
	},
	{
		title: 'TUTORIAL.WEALTH.TITLE',
		description: 'TUTORIAL.WEALTH.DESC',
		videoSrc: 'assets/videos/tutorial/02-wealth.mp4',
	},
	{
		title: 'TUTORIAL.TRANSACTIONS.TITLE',
		description: 'TUTORIAL.TRANSACTIONS.DESC',
		videoSrc: 'assets/videos/tutorial/03-transactions.mp4',
	},
	{
		title: 'TUTORIAL.PRODUCTION.TITLE',
		description: 'TUTORIAL.PRODUCTION.DESC',
		videoSrc: 'assets/videos/tutorial/04-production.mp4',
	},
	{
		title: 'TUTORIAL.ACTIONS.TITLE',
		description: 'TUTORIAL.ACTIONS.DESC',
		videoSrc: 'assets/videos/tutorial/05-actions.mp4',
	},
	{
		title: 'TUTORIAL.JUNE.TITLE',
		description: 'TUTORIAL.JUNE.DESC',
		videoSrc: 'assets/videos/tutorial/06-june.mp4',
	},
	{
		title: 'TUTORIAL.DEBT.TITLE',
		description: 'TUTORIAL.DEBT.DESC',
		videoSrc: 'assets/videos/tutorial/07-debt.mp4',
	},
	{
		title: 'TUTORIAL.REPAYMENT.TITLE',
		description: 'TUTORIAL.REPAYMENT.DESC',
		videoSrc: 'assets/videos/tutorial/08-repayment.mp4',
	},
	{
		title: 'TUTORIAL.SEIZURE.TITLE',
		description: 'TUTORIAL.SEIZURE.DESC',
		videoSrc: 'assets/videos/tutorial/09-seizure.mp4',
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

	@ViewChildren('videoEl') videoEls!: QueryList<ElementRef<HTMLVideoElement>>;

	constructor(
		public dialogRef: MatDialogRef<TutorialDialogComponent>,
		@Inject(MAT_DIALOG_DATA) public data: unknown,
		private i18n: I18nService
	) {}

	ngAfterViewInit(): void {
		this.i18n.loadNamespace('tutorial');
		this.playCurrentVideo();
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

	close(): void {
		this.pauseAll();
		this.dialogRef.close();
	}

	private syncVideo(): void {
		const els = this.videoEls?.toArray() ?? [];
		els.forEach((ref, i) => {
			const el = ref.nativeElement;
			if (i === this.currentIndex) {
				el.currentTime = 0;
				el.play().catch(() => {});
			} else {
				el.pause();
			}
		});
	}

	private playCurrentVideo(): void {
		const els = this.videoEls?.toArray() ?? [];
		els[this.currentIndex]?.nativeElement.play().catch(() => {});
	}

	private pauseAll(): void {
		this.videoEls?.forEach((ref) => ref.nativeElement.pause());
	}
}
