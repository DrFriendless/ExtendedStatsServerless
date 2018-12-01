import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GeekComboComponent } from './geek-combo.component';

describe('GeekComboComponent', () => {
  let component: GeekComboComponent;
  let fixture: ComponentFixture<GeekComboComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GeekComboComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GeekComboComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
