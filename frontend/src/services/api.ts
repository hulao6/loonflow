import axios from 'axios';
import camelcaseKeys from 'camelcase-keys';
import snakecaseKeys from 'snakecase-keys';
import { getCookie, removeCookie } from '../utils/cookie';


const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// URLs that don't require authentication
const PUBLIC_URLS = [
  '/api/v1.0/login',
  '/api/v1.0/manage/auth/login',
  '/api/v1.0/manage/auth/wecom/auth',
  '/api/v1.0/manage/auth/wecom/callback',
  '/api/v1.0/manage/auth/dingtalk/auth',
  '/api/v1.0/manage/auth/dingtalk/callback',
  '/api/v1.0/manage/auth/feishu/auth',
  '/api/v1.0/manage/auth/feishu/callback',
  '/api/v1.0/manage/auth/microsoft/auth',
  '/api/v1.0/manage/auth/microsoft/callback',
];

apiClient.interceptors.request.use(
  (config) => {
    const token = getCookie('jwtToken');
    const isPublicUrl = PUBLIC_URLS.some(url => config.url?.includes(url));

    if (token && !isPublicUrl) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data && typeof config.data === 'object') {
      config.data = snakecaseKeys(config.data, { deep: true });
    }
    if (config.params && typeof config.params === 'object') {
      config.params = snakecaseKeys(config.params, { deep: true });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


apiClient.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object') {
      response.data = camelcaseKeys(response.data, { deep: true });
    }
    return response;
  },
  (error) => {
    // Only redirect to login if 401 is from an authenticated endpoint
    // Don't redirect if the request itself was to a public URL (like login)
    if (error.response && error.response.status === 401) {
      const requestUrl = error.config?.url || '';
      const isPublicUrl = PUBLIC_URLS.some(url => requestUrl.includes(url));

      // Only redirect if this is not a public URL (like login or OAuth)
      if (!isPublicUrl) {
        removeCookie('jwtToken');
        window.location.href = '/signin';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;