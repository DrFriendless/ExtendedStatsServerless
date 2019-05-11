import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AverageVsRatingComponent } from './average-vs-rating.component';

describe('AverageVsRatingComponent', () => {
  let component: AverageVsRatingComponent;
  let fixture: ComponentFixture<AverageVsRatingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AverageVsRatingComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AverageVsRatingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
