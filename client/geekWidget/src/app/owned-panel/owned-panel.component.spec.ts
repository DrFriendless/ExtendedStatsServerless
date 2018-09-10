import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OwnedPanelComponent } from './owned-panel.component';

describe('OwnedPanelComponent', () => {
  let component: OwnedPanelComponent;
  let fixture: ComponentFixture<OwnedPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OwnedPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OwnedPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
