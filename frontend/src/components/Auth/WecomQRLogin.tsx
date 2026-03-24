import { Box, Typography } from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import useSnackbar from '../../hooks/useSnackbar';
import { getMyProfile } from '../../services/user';
import { loginState } from '../../store';
import { setCookie } from '../../utils/cookie';
import { getJwtExpiration } from '../../utils/jwt';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    WwLogin: any;
  }
}

interface WecomQRLoginProps {
  appid: string;
  agentid: string;
  redirectUri: string;
  onClose?: () => void;
}

const WecomQRLogin: React.FC<WecomQRLoginProps> = ({
  appid,
  agentid,
  redirectUri,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showMessage } = useSnackbar();
  const { t } = useTranslation();

  const handleLoginSuccess = useCallback(async (code: string) => {
    try {
      const response = await fetch(`/api/v1.0/manage/oauth/wecom/callback?code=${code}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'TenantId': '00000000-0000-0000-0000-000000000001', // default tenant id
        },
      });

      const result = await response.json();

      if (result.code === 0 && result.data.jwt) {
        const token = result.data.jwt;
        const expiration = getJwtExpiration(token);
        setCookie('jwtToken', token, {
          sameSite: 'strict',
          expires: expiration,
        });

        dispatch(loginState(token));

        // 获取用户信息
        try {
          const userProfileResponse = await getMyProfile();
          if (userProfileResponse.code === 0 && userProfileResponse.data.myProfile.lang) {
            const userLang = userProfileResponse.data.myProfile.lang;
            localStorage.setItem('i18nextLng', userLang);
          }
        } catch (profileError) {
          console.error(t('signIn.getProfileFailed'), profileError);
        }

        showMessage(t('signIn.loginSuccess'), 'success');
        navigate('/');
      } else {
        showMessage(result.msg || t('signIn.loginFailed'), 'error');
        if (onClose) onClose();
      }
    } catch (error: any) {
      console.error(t('signIn.loginFailed'), error);
      showMessage(error.message || t('signIn.loginFailed'), 'error');
      if (onClose) onClose();
    }
  }, [dispatch, navigate, showMessage, onClose, t]);

  useEffect(() => {
    if (!containerRef.current || !window.WwLogin) {
      console.error(t('signIn.wecomSDKNotLoaded'), containerRef.current, window.WwLogin);
      setIsLoading(false);
      return;
    }

    try {
      containerRef.current.innerHTML = '';

      new window.WwLogin({
        id: 'ww_login_container',
        appid: appid,
        agentid: agentid,
        redirect_uri: encodeURIComponent(redirectUri),
        state: Math.random().toString(36).substring(2),
        href: '', // can customize style
      });

      console.log(t('signIn.wecomLoginPanelInitialized'), { appid, agentid, redirectUri });
      setIsLoading(false);

      // listen message event (wechat will send login result via postMessage)
      const handleMessage = async (event: MessageEvent) => {
        // security check: ensure message from wechat
        if (event.origin !== 'https://open.work.weixin.qq.com') {
          return;
        }

        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

          if (data.msgType === 'workwxLogin') {
            if (data.code) {
              // login success, get auth code
              console.log(t('signIn.receivedWecomAuthCode'), data.code);
              await handleLoginSuccess(data.code);
            } else if (data.error) {
              // login failed
              console.error(t('signIn.wecomLoginFailed'), data.error);
              showMessage(t('signIn.loginFailed'), 'error');
            }
          }
        } catch (error) {
          console.error(t('signIn.handleWecomMessageFailed'), error);
        }
      };

      window.addEventListener('message', handleMessage);

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } catch (error) {
      console.error(t('signIn.initializeWecomLoginPanelFailed'), error);
      showMessage(t('signIn.initializeWecomLoginPanelFailed'), 'error');
      setIsLoading(false);
    }
  }, [appid, agentid, redirectUri, handleLoginSuccess, showMessage, t]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 300,
        position: 'relative',
      }}
    >
      {isLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('signIn.loadingScanLogin')}
        </Typography>
      )}
      <div
        id="ww_login_container"
        ref={containerRef}
        style={{
          width: '100%',
          minHeight: '300px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
        {t('signIn.pleaseUseWecomScanLogin')}
      </Typography>
    </Box>
  );
};

export default WecomQRLogin;
