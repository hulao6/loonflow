import apiClient from './api';

/** 认证类型 */
export type AuthConfigType = 'wecom' | 'microsoft_oidc';

/** 列表项：名称、类型、状态、创建时间（及 id 用于编辑/删除） */
export interface AuthConfigListItem {
  id: string;
  name: string;
  type: AuthConfigType;
  typeDisplay: string;
  isEnabled: boolean;
  createdAt: string;
}

/** 详情/表单：包含完整字段，按类型有 agentId 或 azureTenantId */
export interface AuthConfig {
  id: string;
  type: AuthConfigType;
  typeDisplay: string;
  isEnabled: boolean;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  description?: string;
  agentId?: string;
  azureTenantId?: string;
  createdAt?: string;
}

export interface AuthConfigListResponse {
  code: number;
  msg: string;
  data: {
    authConfigList: AuthConfigListItem[];
    paginatorInfo: {
      page: number;
      perPage: number;
      total: number;
    };
  };
}

export interface AuthConfigDetailResponse {
  code: number;
  msg: string;
  data: {
    authConfig: AuthConfig;
  };
}

export interface OAuthTypeInfo {
  type: string;
  name: string;
}

export interface EnabledOAuthTypesResponse {
  code: number;
  msg: string;
  data: {
    /** 后端返回 auth_types，经 api 拦截器转 camelCase 后为 authTypes */
    authTypes?: OAuthTypeInfo[];
    oauthTypes?: OAuthTypeInfo[];
  };
}

/**
 * Get OAuth configuration list
 */
export const getAuthConfigList = async (searchValue: string = '', page: number = 1, perPage: number = 10) => {
  const response = await apiClient.get('/api/v1.0/manage/auth_configs', {
    params: {
      search_value: searchValue,
      page,
      per_page: perPage,
    },
  });
  return response.data as AuthConfigListResponse;
};

/**
 * Get OAuth configuration details
 */
export const getAuthConfigDetail = async (configId: string) => {
  const response = await apiClient.get(`/api/v1.0/manage/auth_configs/${configId}`);
  return response.data as AuthConfigDetailResponse;
};

/**
 * Add OAuth configuration. type is required; for wecom pass agentId, for microsoft_oidc pass azureTenantId.
 */
export const addAuthConfig = async (configData: {
  type: AuthConfigType;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isEnabled?: boolean;
  description?: string;
  agentId?: string;
  azureTenantId?: string;
}) => {
  const response = await apiClient.post('/api/v1.0/manage/auth_configs', configData);
  return response.data;
};

/**
 * Update OAuth configuration
 */
export const updateAuthConfig = async (configId: string, configData: Partial<AuthConfig>) => {
  const response = await apiClient.patch(`/api/v1.0/manage/auth_configs/${configId}`, configData);
  return response.data;
};

/**
 * Delete OAuth configuration
 */
export const deleteAuthConfig = async (configId: string) => {
  const response = await apiClient.delete(`/api/v1.0/manage/auth_configs/${configId}`);
  return response.data;
};

/**
 * Get enabled OAuth login methods
 */
export const getEnabledOAuthTypes = async () => {
  const response = await apiClient.get('/api/v1.0/manage/auth/login');
  return response.data as EnabledOAuthTypesResponse;
};

/**
 * Get Wecom authorization URL
 */
export const getWecomAuthUrl = async () => {
  const response = await apiClient.get('/api/v1.0/manage/auth/wecom/auth');
  return response.data;
};

/**
 * Wecom OAuth callback
 */
export const wecomOAuthCallback = async (code: string) => {
  const response = await apiClient.get('/api/v1.0/manage/auth/wecom/callback', {
    params: { code },
  });
  return response.data;
};
