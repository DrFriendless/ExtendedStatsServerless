import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CollectionPanelComponent } from './collection-panel.component';

describe('CollectionPanelComponent', () => {
  let component: CollectionPanelComponent;
  let fixture: ComponentFixture<CollectionPanelComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CollectionPanelComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CollectionPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
