import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaysTableRowComponent } from './plays-table-row.component';

describe('PlaysTableRowComponent', () => {
  let component: PlaysTableRowComponent;
  let fixture: ComponentFixture<PlaysTableRowComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PlaysTableRowComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PlaysTableRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
