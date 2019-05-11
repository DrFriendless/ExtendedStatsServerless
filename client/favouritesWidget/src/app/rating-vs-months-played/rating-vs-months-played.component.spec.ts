import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingVsMonthsPlayedComponent } from './rating-vs-months-played.component';

describe('RatingVsMonthsPlayedComponent', () => {
  let component: RatingVsMonthsPlayedComponent;
  let fixture: ComponentFixture<RatingVsMonthsPlayedComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RatingVsMonthsPlayedComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RatingVsMonthsPlayedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
