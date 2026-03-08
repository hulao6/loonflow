import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSnackbar from '../../../hooks/useSnackbar';
import type { AuthConfigType } from '../../../services/auth';
import { addAuthConfig, getAuthConfigDetail, updateAuthConfig } from '../../../services/auth';

/** 编辑时仅需 id 与 type，详情在弹窗内拉取 */
interface EditingConfig {
  id: string;
  type: AuthConfigType;
}

interface AuthConfigDialogProps {
  open: boolean;
  /** 新增时由类型选择传入；编辑时来自 config.type */
  type: AuthConfigType | null;
  /** 编辑时传入，新增时为 null */
  config: EditingConfig | null;
  onClose: (shouldRefresh: boolean) => void;
}

const AuthConfigDialog: React.FC<AuthConfigDialogProps> = ({ open, type, config, onClose }) => {
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    agentId: '',
    azureTenantId: '',
    redirectUri: '',
    isEnabled: true,
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const { showMessage } = useSnackbar();
  const { t } = useTranslation();

  const currentType = type ?? config?.type ?? null;

  const loadConfigDetail = useCallback(
    async (configId: string) => {
      try {
        const response = await getAuthConfigDetail(configId);
        if (response.code === 0) {
          const detail = response.data.authConfig;
          setFormData({
            clientId: detail.clientId,
            clientSecret: detail.clientSecret ?? '',
            agentId: detail.agentId ?? '',
            azureTenantId: detail.azureTenantId ?? '',
            redirectUri: detail.redirectUri,
            isEnabled: detail.isEnabled,
            description: detail.description ?? '',
          });
        }
      } catch (error: any) {
        showMessage(error.message || t('setting.authentication.loadConfigFailed'), 'error');
      }
    },
    [showMessage, t]
  );

  useEffect(() => {
    if (open && currentType) {
      if (config) {
        loadConfigDetail(config.id);
      } else {
        const defaultRedirect: Record<AuthConfigType, string> = {
          wecom: window.location.origin + '/oauth/wecom/callback',
          microsoft_oidc: window.location.origin + '/oauth/microsoft/callback',
        };
        setFormData({
          clientId: '',
          clientSecret: '',
          agentId: '',
          azureTenantId: '',
          redirectUri: defaultRedirect[currentType],
          isEnabled: true,
          description: '',
        });
      }
    }
  }, [open, currentType, config, loadConfigDetail]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!currentType) return;
    if (!formData.clientId || !formData.clientSecret || !formData.redirectUri) {
      showMessage(t('setting.authentication.pleaseFillRequiredFields'), 'warning');
      return;
    }
    if (currentType === 'wecom' && !formData.agentId) {
      showMessage(t('setting.authentication.wecomNeedToFillAgentId'), 'warning');
      return;
    }
    if (currentType === 'microsoft_oidc' && !formData.azureTenantId) {
      showMessage(t('setting.authentication.microsoftNeedTenantId'), 'warning');
      return;
    }

    setLoading(true);
    try {
      if (config) {
        const response = await updateAuthConfig(config.id, {
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri,
          isEnabled: formData.isEnabled,
          description: formData.description,
          ...(currentType === 'wecom' ? { agentId: formData.agentId } : { azureTenantId: formData.azureTenantId }),
        });
        if (response.code === 0) {
          showMessage(t('common.updateSuccess'), 'success');
          onClose(true);
        } else {
          showMessage((response as any).msg || t('common.operationFailed'), 'error');
        }
      } else {
        const response = await addAuthConfig({
          type: currentType,
          clientId: formData.clientId,
          clientSecret: formData.clientSecret,
          redirectUri: formData.redirectUri,
          isEnabled: formData.isEnabled,
          description: formData.description,
          ...(currentType === 'wecom' ? { agentId: formData.agentId } : { azureTenantId: formData.azureTenantId }),
        });
        if (response.code === 0) {
          showMessage(t('common.addSuccess'), 'success');
          onClose(true);
        } else {
          showMessage((response as any).msg || t('common.operationFailed'), 'error');
        }
      }
    } catch (error: any) {
      showMessage(error.message || t('common.operationFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTypeHelperText = () => {
    if (currentType === 'wecom') return t('setting.authentication.wecomScanLoginDescription');
    if (currentType === 'microsoft_oidc') return t('setting.authentication.microsoftOidcDescription');
    return '';
  };

  const getClientIdLabel = () => (currentType === 'wecom' ? t('setting.authentication.corpId') : 'Client ID');
  const getClientSecretLabel = () =>
    currentType === 'wecom' ? t('setting.authentication.corpSecret') : 'Client Secret';

  if (!open || !currentType) return null;

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth>
      <DialogTitle>
        {config ? t('setting.authentication.editAuthentication') : t('setting.authentication.addAuthentication')} -{' '}
        {currentType === 'wecom' ? t('setting.authentication.typeWecom') : t('setting.authentication.typeMicrosoftOidc')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            {getTypeHelperText()}
          </Alert>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={getClientIdLabel()}
                value={formData.clientId}
                onChange={(e) => handleChange('clientId', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={getClientSecretLabel()}
                value={formData.clientSecret}
                onChange={(e) => handleChange('clientSecret', e.target.value)}
                type="password"
                required
              />
            </Grid>

            {currentType === 'wecom' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('setting.authentication.agentId')}
                  value={formData.agentId}
                  onChange={(e) => handleChange('agentId', e.target.value)}
                  required
                  helperText={t('setting.authentication.agentIdHelper')}
                />
              </Grid>
            )}

            {currentType === 'microsoft_oidc' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('setting.authentication.azureTenantId')}
                  value={formData.azureTenantId}
                  onChange={(e) => handleChange('azureTenantId', e.target.value)}
                  required
                  helperText={t('setting.authentication.azureTenantIdHelper')}
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('setting.authentication.redirectUri')}
                value={formData.redirectUri}
                onChange={(e) => handleChange('redirectUri', e.target.value)}
                required
                helperText={t('setting.authentication.redirectUriHelper')}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('setting.authentication.description')}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) => handleChange('isEnabled', e.target.checked)}
                  />
                }
                label={t('setting.authentication.enableConfig')}
              />
              {formData.isEnabled && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4 }}>
                  {t('setting.authentication.enableConfigNote')}
                </Typography>
              )}
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>{t('common.cancel')}</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? t('common.submitting') : t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AuthConfigDialog;
