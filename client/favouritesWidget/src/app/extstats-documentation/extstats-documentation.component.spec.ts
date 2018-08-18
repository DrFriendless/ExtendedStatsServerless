import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ExtstatsDocumentationComponent } from './extstats-documentation.component';

describe('ExtstatsDocumentationComponent', () => {
  let component: ExtstatsDocumentationComponent;
  let fixture: ComponentFixture<ExtstatsDocumentationComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ExtstatsDocumentationComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ExtstatsDocumentationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
