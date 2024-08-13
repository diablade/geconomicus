import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortcodeDialogComponent } from './shortcode-dialog.component';

describe('ShortcodeDialogComponent', () => {
  let component: ShortcodeDialogComponent;
  let fixture: ComponentFixture<ShortcodeDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShortcodeDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShortcodeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
