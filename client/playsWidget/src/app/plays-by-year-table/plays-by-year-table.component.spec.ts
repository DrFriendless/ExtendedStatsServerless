import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByYearTableComponent } from './plays-by-year-table.component';

describe('PlaysByYearTableComponent', () => {
  let component: PlaysByYearTableComponent;
  let fixture: ComponentFixture<PlaysByYearTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByYearTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByYearTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
