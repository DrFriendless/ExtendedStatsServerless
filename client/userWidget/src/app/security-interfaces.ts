export interface Identity {
  jwt: string;
}

export interface UserData {
  username: string;
  first: boolean;
  jwt: Decoded;
}

export interface PersonalData {
  userData: UserData;
  allData: object;
}


export interface Decoded {
  nickname: string;
  sub: string;
}
