import axios, { AxiosInstance } from 'axios';
import { config } from './config';
import { authService } from './auth';
import { Bet, CreateBetRequest, BetLeg, ExtractedBet } from '../types/bet';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.apiEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await authService.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  async getBets(filters?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
  }): Promise<Bet[]> {
    const response = await this.client.get('/bets', { params: filters });
    return response.data.data.bets;
  }

  async createBet(bet: CreateBetRequest): Promise<Bet> {
    const response = await this.client.post('/bets', bet);
    return response.data.data;
  }

  async updateBet(
    betId: string,
    updates: {
      status?: string;
      legs?: BetLeg[];
      attributedTo?: string;
      featured?: boolean;
      // Single bet fields
      sport?: string;
      teams?: string;
      betType?: string;
      selection?: string;
      odds?: number;
      amount?: number;
      date?: string;
      potentialPayout?: number;
    }
  ): Promise<Bet> {
    const response = await this.client.put(`/bets/${betId}`, updates);
    return response.data.data;
  }

  async deleteBet(betId: string): Promise<void> {
    await this.client.delete(`/bets/${betId}`);
  }

  async clearWeek(): Promise<{ deletedCount: number }> {
    const response = await this.client.delete('/bets/week/clear');
    return response.data.data;
  }

  async processBetSlip(imageBase64: string): Promise<{
    bets: ExtractedBet[];
    warnings?: string[];
  }> {
    const response = await this.client.post('/betslip/process', { imageBase64 });
    return response.data.data;
  }

  async getUserProfile(): Promise<{
    userId: string;
    email: string;
    role: 'user' | 'admin';
    featureFlags: {
      canCreateBets: boolean;
      canManageBets: boolean;
      canDeleteBets: boolean;
      canClearWeek: boolean;
      canBetslipImport: boolean;
    };
    createdAt?: string;
    updatedAt?: string;
  }> {
    const response = await this.client.get('/users/profile');
    return response.data.data;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password', { oldPassword, newPassword });
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.post('/auth/forgot-password', { email });
  }

  async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/confirm-password-reset', { email, code, newPassword });
  }
}

export const apiClient = new ApiClient();

