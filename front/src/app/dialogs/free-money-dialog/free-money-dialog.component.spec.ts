import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FreeMoneyDialogComponent } from './free-money-dialog.component';

describe('FreeMoneyDialogComponent', () => {
	let component: FreeMoneyDialogComponent;
	let fixture: ComponentFixture<FreeMoneyDialogComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [FreeMoneyDialogComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(FreeMoneyDialogComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
