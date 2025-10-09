export interface ExtStatsStorage {
  geek: string;
}

function getExtStatsStorage(): ExtStatsStorage {
  const localStorage = window.localStorage;
  console.log(typeof localStorage.extStats);
  let result = {};
  if (localStorage.extStats) {
    try {
      result = JSON.parse(localStorage.extStats);
    } catch (err) {
      console.log(err);
    }
  }
  return result as ExtStatsStorage;
}

export function withExtStatsStorage(func: (storage: ExtStatsStorage) => void) {
  const content = getExtStatsStorage();
  func(content);
  window.localStorage.extStats = JSON.stringify(content);
}

export function fromExtStatsStorage<T>(func: (storage: ExtStatsStorage) => T) {
  const content = getExtStatsStorage();
  const returnValue = func(content);
  window.localStorage.extStats = JSON.stringify(content);
  return returnValue;
}

