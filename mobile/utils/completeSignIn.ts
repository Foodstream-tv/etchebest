import apiService from '@/services/api';
import { authService, StoredUser } from '@/services/auth';

/** The token was accepted but `/users/me` could not be read: no session is persisted. */
export class ProfileUnavailableError extends Error {
  readonly cause: unknown;

  constructor(cause?: unknown) {
    super('Unable to load the user profile');
    this.name = 'ProfileUnavailableError';
    this.cause = cause;
  }
}

/**
 * Finishes a sign-in (login, e-mail verification, Google): loads the profile with the
 * explicit token, then persists token + user. Same order as the web (`/users/me` first,
 * `setAuth` after) so the app never keeps a half-session: when the profile cannot be
 * loaded nothing is stored and the caller shows an error / lets the user retry.
 */
export async function completeSignIn(token: string): Promise<StoredUser> {
  let profile;
  try {
    profile = await apiService.getProfile(token);
  } catch (error) {
    throw new ProfileUnavailableError(error);
  }

  if (!profile?.id) {
    throw new ProfileUnavailableError();
  }

  const user: StoredUser = {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    firstName: profile.firstName,
    lastName: profile.lastName,
    description: profile.description,
    profileImageUrl: profile.profileImageUrl,
    role: profile.role,
  };

  await authService.saveAuth(token, user);
  return user;
}
