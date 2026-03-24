import { Box, CircularProgress, Typography } from '@mui/material';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSnackbar from '../../hooks/useSnackbar';
import { microsoftOidcOAuthCallback } from '../../services/auth';
import { getMyProfile } from '../../services/user';
import { loginState } from '../../store';
import { getCookie, setCookie } from '../../utils/cookie';
import { getJwtExpiration } from '../../utils/jwt';

/**
 * Microsoft OIDC callback page:
 * 1) URL contains code: frontend calls backend API with code to get JWT, writes Cookie and updates store, then redirects to homepage
 * 2) URL fragment contains token: backend has already processed and redirected to this page (frontend and backend may be on different domains, token is placed in fragment), writes Cookie and redirects to homepage
 */
function getTokenFromFragment(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return params.get('token');
}

const MicrosoftOidcCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showMessage } = useSnackbar();
  const { t } = useTranslation();

  const handleCallback = useCallback(async () => {
    const code = searchParams.get('code');

    if (code) {
      try {
        const responseData = await microsoftOidcOAuthCallback(code);
        if (responseData.code !== 0) {
          showMessage(responseData.msg || t('signIn.loginFailed'), 'error');
          navigate('/signIn');
          return;
        }
        const token = responseData.data.jwt;
        const expiration = getJwtExpiration(token);
        setCookie('jwtToken', token, {
          sameSite: 'strict',
          expires: expiration,
        });
        dispatch(loginState(token));
        try {
          const userProfileResponse = await getMyProfile();
          if (userProfileResponse.code === 0 && userProfileResponse.data.myProfile?.lang) {
            const userLang = userProfileResponse.data.myProfile.lang;
            const localStorageLang = localStorage.getItem('i18nextLng');
            if (localStorageLang !== userLang) {
              // Language switching can be done here
            }
          }
        } catch (profileError) {
          console.error('Failed to get user profile:', profileError);
        }
        showMessage(t('signIn.loginSuccess'), 'success');
        navigate('/');
      } catch (error: any) {
        showMessage(error.message || t('signIn.loginFailed'), 'error');
        navigate('/signIn');
      }
      return;
    }

    const tokenFromFragment = getTokenFromFragment();
    if (tokenFromFragment) {
      const expiration = getJwtExpiration(tokenFromFragment);
      setCookie('jwtToken', tokenFromFragment, {
        sameSite: 'strict',
        expires: expiration ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      dispatch(loginState(tokenFromFragment));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      showMessage(t('signIn.loginSuccess'), 'success');
      navigate('/');
      return;
    }

    const token = getCookie('jwtToken');
    if (token) {
      dispatch(loginState(token));
      showMessage(t('signIn.loginSuccess'), 'success');
      navigate('/');
      return;
    }

    const errorMsg = searchParams.get('error');
    if (errorMsg) {
      showMessage(decodeURIComponent(errorMsg), 'error');
    }
    navigate('/signIn');
  }, [searchParams, navigate, dispatch, showMessage, t]);

  useEffect(() => {
    handleCallback();
  }, [handleCallback]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1">{t('signIn.loggingIn')}</Typography>
    </Box>
  );
};

export default MicrosoftOidcCallback;
