export type JwtPair = { accessToken: string; refreshToken: string };

export type JwtPayload = {
  sub: string;       // user id
  email: string;
};
