import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OwnedByPublishedYearComponent } from './owned-by-published-year.component';

describe('OwnedByPublishedYearComponent', () => {
  let component: OwnedByPublishedYearComponent;
  let fixture: ComponentFixture<OwnedByPublishedYearComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OwnedByPublishedYearComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnedByPublishedYearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
