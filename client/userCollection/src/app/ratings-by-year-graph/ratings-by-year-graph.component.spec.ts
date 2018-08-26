import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RatingsByYearGraphComponent } from './ratings-by-year-graph.component';

describe('RatingsByYearGraphComponent', () => {
  let component: RatingsByYearGraphComponent;
  let fixture: ComponentFixture<RatingsByYearGraphComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RatingsByYearGraphComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RatingsByYearGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
