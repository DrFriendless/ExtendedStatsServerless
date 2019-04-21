import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByMonthTableComponent } from './plays-by-month-table.component';

describe('PlaysByMonthTableComponent', () => {
  let component: PlaysByMonthTableComponent;
  let fixture: ComponentFixture<PlaysByMonthTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByMonthTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByMonthTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
