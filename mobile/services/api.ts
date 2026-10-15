import { ApiError, request } from './http';

export { ApiError };

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  description: string;
  countryNumberPhone: number;
  numberPhone: string;
  profileImage?: string;
}

/** `/login` only returns the token; `user` is present on verify / Google sign-in. */
export interface AuthResponse {
  token: string;
  user?: {
    id: string;
    email: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };
}

export interface RegisterResponse {
  message: string;
  userId: string;
  /** Masked email the code was sent to */
  target: string;
  /** Only returned by the backend in dev mode */
  devCode?: string;
}

export interface ResendCodeResponse {
  message: string;
  userId?: string;
  target?: string;
  devCode?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImageUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  passwordUpdatedAt?: string;
  countryNumberPhone: number;
  numberPhone: string;
  role: string;
  followingIds: string[];
  followersIds: string[];
}

export interface PasswordUpdateRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordUpdateResponse {
  message: string;
  passwordUpdatedAt: string;
}

export interface UpdateProfileRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  profileImageUrl?: string;
  description?: string;
  countryNumberPhone?: number;
  numberPhone?: string;
}

const trimmed = (value: string | undefined) => (value === undefined ? undefined : value.trim());

class ApiService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/login', {
      method: 'POST',
      auth: 'none',
      body: {
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      },
    });
  }

  async loginWithGoogle(accessToken: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/google/mobile', {
      method: 'POST',
      auth: 'none',
      body: { access_token: accessToken },
    });
  }

  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return request<RegisterResponse>('/register', {
      method: 'POST',
      auth: 'none',
      body: {
        ...data,
        email: data.email.trim().toLowerCase(),
        username: data.username.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        description: data.description.trim(),
        numberPhone: data.numberPhone.trim(),
      },
    });
  }

  /** Confirms the 6-digit code; the backend answers with a ready-to-use token. */
  async verifyAccount(params: { userId?: string; email?: string; code: string }): Promise<AuthResponse> {
    return request<AuthResponse>('/verify', {
      method: 'POST',
      auth: 'none',
      body: {
        userId: params.userId || undefined,
        email: params.email?.trim().toLowerCase() || undefined,
        code: params.code.trim(),
      },
    });
  }

  async resendVerificationCode(params: { userId?: string; email?: string }): Promise<ResendCodeResponse> {
    return request<ResendCodeResponse>('/resend-code', {
      method: 'POST',
      auth: 'none',
      body: {
        userId: params.userId || undefined,
        email: params.email?.trim().toLowerCase() || undefined,
      },
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/forgot-password', {
      method: 'POST',
      auth: 'none',
      body: { email: email.trim().toLowerCase() },
    });
  }

  async getProfile(token?: string): Promise<UserProfile> {
    return this.authed<UserProfile>('/users/me', { method: 'GET' }, token);
  }

  async updateProfile(token: string | undefined, data: UpdateProfileRequest): Promise<UserProfile> {
    const payload: UpdateProfileRequest = {};

    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.firstName !== undefined) payload.firstName = trimmed(data.firstName);
    if (data.lastName !== undefined) payload.lastName = trimmed(data.lastName);
    if (data.username !== undefined) payload.username = trimmed(data.username);
    if (data.profileImageUrl !== undefined) payload.profileImageUrl = trimmed(data.profileImageUrl);
    if (data.description !== undefined) payload.description = trimmed(data.description);
    if (data.countryNumberPhone !== undefined) payload.countryNumberPhone = data.countryNumberPhone;
    if (data.numberPhone !== undefined) payload.numberPhone = trimmed(data.numberPhone);

    return this.authed<UserProfile>('/users/me', { method: 'PATCH', body: payload }, token);
  }

  async updatePassword(token: string | undefined, data: PasswordUpdateRequest): Promise<PasswordUpdateResponse> {
    return this.authed<PasswordUpdateResponse>(
      '/users/me/password',
      {
        method: 'PATCH',
        body: { currentPassword: data.currentPassword, newPassword: data.newPassword },
      },
      token
    );
  }

  /** Everything the platform holds about the signed-in user (GDPR access and portability). */
  async exportMyData(): Promise<unknown> {
    return this.authed<unknown>('/users/me/export', { method: 'GET' });
  }

  async deleteCurrentUser(token?: string): Promise<void> {
    await this.authed<unknown>('/users/me', { method: 'DELETE' }, token);
  }

  /**
   * Calls an authenticated endpoint. An explicit token (right after login,
   * before it is persisted) is sent as-is; otherwise the stored one is used.
   */
  private async authed<T>(
    path: string,
    options: { method: 'GET' | 'PATCH' | 'DELETE'; body?: unknown },
    explicitToken?: string
  ): Promise<T> {
    return request<T>(path, { ...options, token: explicitToken });
  }
}

export default new ApiService();
