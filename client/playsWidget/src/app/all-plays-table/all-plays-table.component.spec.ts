import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AllPlaysTableComponent } from './all-plays-table.component';

describe('AllPlaysTableComponent', () => {
  let component: AllPlaysTableComponent;
  let fixture: ComponentFixture<AllPlaysTableComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AllPlaysTableComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AllPlaysTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
