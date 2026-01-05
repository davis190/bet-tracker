import { CognitoUser, CognitoUserPool, AuthenticationDetails, CognitoUserSession, CognitoUserAttribute } from 'amazon-cognito-identity-js';
import { config } from './config';

// Validate Cognito configuration
if (!config.cognito.userPoolId || !config.cognito.clientId) {
  console.error('Cognito configuration is missing. Required environment variables:');
  console.error('  VITE_COGNITO_USER_POOL_ID:', config.cognito.userPoolId || 'MISSING');
  console.error('  VITE_COGNITO_CLIENT_ID:', config.cognito.clientId || 'MISSING');
  throw new Error('Cognito configuration is incomplete. Both UserPoolId and ClientId are required.');
}

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

interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

export const authService = {
  async login(email: string, password: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
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
        onSuccess: (result: CognitoUserSession) => {
          const idToken = result.getIdToken();
          const payload = idToken.payload;
          
          resolve({
            user: {
              username: payload['cognito:username'] as string || email,
              email: (payload.email as string) || email,
              sub: payload.sub as string,
            },
            tokens: {
              idToken: result.getIdToken().getJwtToken(),
              accessToken: result.getAccessToken().getJwtToken(),
              refreshToken: result.getRefreshToken().getToken(),
            },
          });
        },
        onFailure: (err: Error) => {
          reject(err);
        },
        newPasswordRequired: (userAttributes: any, requiredAttributes: any) => {
          // This will be handled by handleNewPasswordRequired
          reject(new Error('NEW_PASSWORD_REQUIRED'));
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

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        cognitoUser.getUserAttributes((err: Error | undefined, attributes: CognitoUserAttribute[] | undefined) => {
          if (err) {
            reject(err);
            return;
          }

          const email = attributes?.find((attr: CognitoUserAttribute) => attr.Name === 'email')?.Value || '';
          const sub = session.getIdToken().payload.sub as string;

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

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        resolve(session.getIdToken().getJwtToken());
      });
    });
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) {
      throw new Error('No user session');
    }

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          reject(new Error('Invalid session'));
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err: Error | undefined) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  },

  async handleNewPasswordRequired(email: string, newPassword: string): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (result: CognitoUserSession) => {
          const idToken = result.getIdToken();
          const payload = idToken.payload;
          
          resolve({
            user: {
              username: payload['cognito:username'] as string || email,
              email: (payload.email as string) || email,
              sub: payload.sub as string,
            },
            tokens: {
              idToken: result.getIdToken().getJwtToken(),
              accessToken: result.getAccessToken().getJwtToken(),
              refreshToken: result.getRefreshToken().getToken(),
            },
          });
        },
        onFailure: (err: Error) => {
          reject(err);
        },
      });
    });
  },

  async forgotPassword(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve();
        },
        onFailure: (err: Error) => {
          reject(err);
        },
      });
    });
  },

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve();
        },
        onFailure: (err: Error) => {
          reject(err);
        },
      });
    });
  },
};

