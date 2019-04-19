import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TableControllerComponent } from './table-controller.component';

describe('TableControllerComponent', () => {
  let component: TableControllerComponent;
  let fixture: ComponentFixture<TableControllerComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TableControllerComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TableControllerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
