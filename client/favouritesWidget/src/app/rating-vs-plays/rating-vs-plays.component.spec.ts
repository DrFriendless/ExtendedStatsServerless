import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingVsPlaysComponent } from './rating-vs-plays.component';

describe('RatingVsPlaysComponent', () => {
  let component: RatingVsPlaysComponent;
  let fixture: ComponentFixture<RatingVsPlaysComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RatingVsPlaysComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RatingVsPlaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
