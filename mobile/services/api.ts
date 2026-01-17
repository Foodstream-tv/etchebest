// API Configuration
import config from '../config/env';

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

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
  };
}

export interface ApiError {
  message: string;
  error?: string;
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
  countryNumberPhone: number;
  numberPhone: string;
  role: string;
  followingIds: string[];
  followersIds: string[];
}

export interface Room {
  id: string;
  name: string;
  host: string;
  participants: string[];
  viewers: number;
  maxParticipants: number;
}

class ApiService {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string = config.apiBaseUrl, timeout: number = config.apiTimeout) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = this.timeout
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('La requête a expiré. Vérifiez votre connexion.');
      }
      if (error instanceof TypeError) {
        // Typical network failures (DNS, connexion refusée, hors ligne, etc.)
        const details = error.message ? ` (${error.message})` : '';
        throw new Error(`Erreur réseau lors de la requête${details}. Vérifiez votre connexion ou réessayez plus tard.`);
      }
      const details =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
          ? error
          : '';
      const suffix = details ? ` Détails : ${details}` : '';
      throw new Error(`Erreur réseau inattendue.${suffix}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: `HTTP error! status: ${response.status}`,
      }));
      throw new Error(error.message || error.error || "Une erreur s'est produite");
    }
    return response.json();
  }

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      }),
    });
    return this.handleResponse<AuthResponse>(response);
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        email: data.email.trim().toLowerCase(),
        username: data.username.trim(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        description: data.description.trim(),
        numberPhone: data.numberPhone.trim(),
      }),
    });
    return this.handleResponse<AuthResponse>(response);
  }

  async getProfile(token: string): Promise<UserProfile> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return this.handleResponse<UserProfile>(response);
  }

  async getRooms(token: string): Promise<Room[]> {
    const response = await this.fetchWithTimeout(`${this.baseUrl}/rooms`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    return this.handleResponse<Room[]>(response);
  }
}

export default new ApiService();
