const AuthorizationDuration = 24 * 60 * 60 * 1000

export const getNewAuthorizationExpiration = () => Date.now() + AuthorizationDuration

const AuthorizationExpiration = new Map<string, number>()

export default AuthorizationExpiration
