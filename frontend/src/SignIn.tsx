import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import WecomQRLogin from './components/Auth/WecomQRLogin';
import useSnackbar from './hooks/useSnackbar';
import { getEnabledOAuthTypes, getWecomAuthUrl } from './services/auth';
import { login } from './services/authService';
import { getMyProfile } from './services/user';
import { loginState } from './store';
import { setCookie } from './utils/cookie';
import { getJwtExpiration } from './utils/jwt';


function Copyright(props: any) {
  return (
    <Typography variant="body2" color="text.secondary" align="center" {...props}>
      {'Copyright © '}
      <Link color="inherit" href="https://github.com/blackholll/loonflow">
        loonflow
      </Link>{' '}
      {'2018-' + new Date().getFullYear()}
      {'.'}
    </Typography>
  );
}


const defaultTheme = createTheme();

export default function SignIn() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [oauthTypes, setOauthTypes] = useState<Array<{ type: string; name: string }>>([]);
  const [showWecomDialog, setShowWecomDialog] = useState(false);
  const [wecomConfig, setWecomConfig] = useState<{
    appid: string;
    agentid: string;
    redirectUri: string;
  } | null>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showMessage } = useSnackbar();

  useEffect(() => {
    // Load available OAuth login methods
    loadOAuthTypes();
  }, []);

  const loadOAuthTypes = async () => {
    try {
      const response = await getEnabledOAuthTypes();
      if (response.code === 0 && response.data) {
        // backend return auth_types, after api interceptor convert to camelCase is authTypes
        const list = response.data.authTypes ?? response.data.oauthTypes ?? [];
        setOauthTypes(Array.isArray(list) ? list : []);
      }
    } catch (error) {
      // Ignore errors, don't show OAuth login options
      console.error('Failed to load OAuth types:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const responseData = await login(email, password);
      if (responseData.code === -1) {
        showMessage(responseData.msg, 'error');
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
        if (userProfileResponse.code === 0 && userProfileResponse.data.myProfile.lang) {
          const userLang = userProfileResponse.data.myProfile.lang;
          const localStorageLang = localStorage.getItem('i18nextLng');

          if (localStorageLang !== userLang) {
            i18n.changeLanguage(userLang);
          }
        }
      } catch (profileError) {
        console.error('get userprofile fail:', profileError);
      }

      navigate('/');
    } catch (error: any) {
      showMessage(error.message, 'error');
      console.error('login fail:', error);
    }
  };

  const handleOAuthLogin = async (type: string) => {
    try {
      if (type === 'wecom') {
        // get wechat config and open scan login dialog
        const response = await getWecomAuthUrl();
        if (response.code === 0) {
          const { appid, agentid, redirectUri } = response.data;
          if (appid && agentid && redirectUri) {
            //use scan login method
            setWecomConfig({ appid, agentid, redirectUri });
            setShowWecomDialog(true);
          } else if (response.data.authUrl) {
            // downgrade to redirect method
            window.location.href = response.data.authUrl;
          } else {
            showMessage('wechat config is incomplete', 'error');
          }
        } else {
          showMessage(response.msg || 'get auth url failed', 'error');
        }
      } else {
        showMessage('this login method is not implemented yet', 'info');
      }
    } catch (error: any) {
      showMessage(error.message || 'OAuth login failed', 'error');
    }
  };

  const getOAuthButtonText = (type: string) => {
    const texts: Record<string, string> = {
      wecom: t('signIn.wecomLogin'),
      dingtalk: t('signIn.dingtalkLogin'),
      feishu: t('signIn.feishuLogin'),
      microsoft: t('signIn.microsoftLogin'),
    };
    return texts[type] || type;
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Container component="main" maxWidth="xs">
        <CssBaseline />
        <Box
          sx={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >

            <img src={"/loonflow_logo1.png"} alt="Logo" style={{ width: '50px', height: '50px', display: 'block' }} />
            <Typography variant="h5" sx={{ ml: 2 }}>
              {t('signIn.title')}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ textAlign: 'center', mt: 2, maxWidth: '100%' }}>
            {t('signIn.description')}
          </Typography>
          <Box component="form" noValidate sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label={t('signIn.emailLabel')}
              name="email"
              autoComplete="email"
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('signIn.passwordLabel')}
              type="password"
              id="password"
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              fullWidth
              onClick={handleSubmit}
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              {t('signIn.signInButton')}
            </Button>

            {oauthTypes && oauthTypes.length > 0 && (
              <>
                <Divider sx={{ my: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('signIn.orUseTheFollowingMethodsToLogin')}
                  </Typography>
                </Divider>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {oauthTypes.map((oauth) => (
                    <Button
                      key={oauth.type}
                      fullWidth
                      variant="outlined"
                      onClick={() => handleOAuthLogin(oauth.type)}
                    >
                      {getOAuthButtonText(oauth.type)}
                    </Button>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
        <Copyright sx={{ mt: 8, mb: 4 }} />

        {/* wechat scan login dialog */}
        <Dialog
          open={showWecomDialog}
          onClose={() => setShowWecomDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {t('signIn.wecomScanLogin')}
            <IconButton
              aria-label="close"
              onClick={() => setShowWecomDialog(false)}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: (theme) => theme.palette.grey[500],
              }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            {wecomConfig && (
              <WecomQRLogin
                appid={wecomConfig.appid}
                agentid={wecomConfig.agentid}
                redirectUri={wecomConfig.redirectUri}
                onClose={() => setShowWecomDialog(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </Container>
    </ThemeProvider >
  );
}