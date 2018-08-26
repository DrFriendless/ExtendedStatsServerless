import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { FavesByYearTableComponent } from './faves-by-year-table.component';

describe('FavesByYearTableComponent', () => {
  let component: FavesByYearTableComponent;
  let fixture: ComponentFixture<FavesByYearTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ FavesByYearTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(FavesByYearTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
