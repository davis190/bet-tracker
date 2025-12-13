import { CognitoUser, CognitoUserPool, AuthenticationDetails } from 'amazon-cognito-identity-js';
import { config } from './config';

const poolData = {
  UserPoolId: config.cognito.userPoolId,
  ClientId: config.cognito.clientId,
};

const userPool = new CognitoUserPool(poolData);

export interface AuthUser {
  username: string;
  email: string;
  sub: string;
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: any }> {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const idToken = result.getIdToken();
          const payload = idToken.getPayload();
          
          resolve({
            user: {
              username: payload['cognito:username'] || email,
              email: payload.email || email,
              sub: payload.sub,
            },
            tokens: {
              idToken: result.getIdToken().getJwtToken(),
              accessToken: result.getAccessToken().getJwtToken(),
              refreshToken: result.getRefreshToken().getToken(),
            },
          });
        },
        onFailure: (err) => {
          reject(err);
        },
      });
    });
  },

  async logout(): Promise<void> {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: any) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        cognitoUser.getUserAttributes((err, attributes) => {
          if (err) {
            reject(err);
            return;
          }

          const email = attributes?.find(attr => attr.Name === 'email')?.Value || '';
          const sub = session.getIdToken().payload.sub;

          resolve({
            username: cognitoUser.getUsername(),
            email,
            sub,
          });
        });
      });
    });
  },

  async getIdToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();
      
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: any) => {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        resolve(session.getIdToken().getJwtToken());
      });
    });
  },
};

