import { api } from './client';

export type Profile = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  location: string;
  email: string;
  website: string;
  github: string;
  linkedin: string;
  twitter: string;
};

export const getProfile = () => api<Profile>('/profile');
export const updateProfile = (data: Partial<Profile>) =>
  api<Profile>('/profile', { method: 'PUT', body: JSON.stringify(data) });
