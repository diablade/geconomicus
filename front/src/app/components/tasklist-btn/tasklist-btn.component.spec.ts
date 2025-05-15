import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TaskListBtnComponent } from './tasklist-btn.component';

describe('TaskListBtnComponent', () => {
  let component: TaskListBtnComponent;
  let fixture: ComponentFixture<TaskListBtnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TaskListBtnComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskListBtnComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
