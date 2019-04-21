import { TestBed } from '@angular/core/testing';

import { PlayIndexService } from './play-index.service';

describe('PlayIndexService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: PlayIndexService = TestBed.get(PlayIndexService);
    expect(service).toBeTruthy();
  });
});
