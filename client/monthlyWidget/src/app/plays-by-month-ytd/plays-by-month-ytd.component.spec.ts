import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysByMonthYtdComponent } from './plays-by-month-ytd.component';

describe('PlaysByMonthYtdComponent', () => {
  let component: PlaysByMonthYtdComponent;
  let fixture: ComponentFixture<PlaysByMonthYtdComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysByMonthYtdComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysByMonthYtdComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
