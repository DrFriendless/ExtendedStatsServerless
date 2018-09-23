import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByPublishedYearComponent } from './plays-by-published-year.component';

describe('PlaysByPublishedYearComponent', () => {
  let component: PlaysByPublishedYearComponent;
  let fixture: ComponentFixture<PlaysByPublishedYearComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByPublishedYearComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByPublishedYearComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
