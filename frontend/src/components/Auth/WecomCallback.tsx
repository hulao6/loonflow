import { Box, CircularProgress, Typography } from '@mui/material';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSnackbar from '../../hooks/useSnackbar';
import { wecomOAuthCallback } from '../../services/auth';
import { getMyProfile } from '../../services/user';
import { loginState } from '../../store';
import { setCookie } from '../../utils/cookie';
import { getJwtExpiration } from '../../utils/jwt';

const WecomCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showMessage } = useSnackbar();
  const { t } = useTranslation();

  const handleCallback = useCallback(async () => {
    const code = searchParams.get('code');

    if (!code) {
      showMessage(t('signIn.missingAuthCode'), 'error');
      navigate('/signin');
      return;
    }

    try {
      const response = await wecomOAuthCallback(code);

      if (response.code === 0) {
        const token = response.data.jwt;
        const expiration = getJwtExpiration(token);
        setCookie('jwtToken', token, {
          sameSite: 'strict',
          expires: expiration,
        });

        dispatch(loginState(token));

        // Get user profile
        try {
          const userProfileResponse = await getMyProfile();
          if (userProfileResponse.code === 0 && userProfileResponse.data.myProfile.lang) {
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
      } else {
        showMessage(response.msg || t('signIn.loginFailed'), 'error');
        navigate('/signin');
      }
    } catch (error: any) {
      showMessage(error.message || t('signIn.loginFailed'), 'error');
      navigate('/signin');
    }
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

export default WecomCallback;
