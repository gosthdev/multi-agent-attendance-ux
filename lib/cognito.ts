const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION || 'us-east-1';
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

export interface CognitoAuthResult {
  AccessToken: string;
  ExpiresIn: number;
  IdToken: string;
  RefreshToken?: string;
  TokenType: string;
}

export async function loginWithCognito(email: string, password: string): Promise<CognitoAuthResult> {
  if (!CLIENT_ID) {
    throw new Error('NEXT_PUBLIC_COGNITO_CLIENT_ID is not configured in environment variables.');
  }

  const url = `https://cognito-idp.${REGION}.amazonaws.com/`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Parse Cognito error types or messages
    const errorMessage = data.message || 'Error de autenticación';
    throw new Error(errorMessage);
  }

  return data.AuthenticationResult;
}

export function parseJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    return null;
  }
}
